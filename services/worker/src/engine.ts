import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { ROLES } from '../../../packages/roles/index.js';
import { INJECTION, commonReplies, fill } from '../../../packages/roles/common.js';
import { LOCALES, type Finish, type Locale, type PlaybookContext, type RoleDefinition, type Sandbox, type ToolOutcome } from '../../../packages/roles/types.js';
import { classifyIntent, draftText, llmEnabled } from './llm.js';
import { callN8nTool } from './n8n.js';

// Raised for every policy decision that must stop the run; the executor rolls the transaction back
// and records the run as blocked with this reason (never with raw input text).
export class RolePolicyError extends Error {}
const SAFE_TOOL_ERRORS = new Set(['record_missing', 'slot_conflict', 'version_conflict', 'duplicate_invoice', 'verification_failed', 'invalid_state']);
const MIN_LLM_CONFIDENCE = 0.7;

type Tx = Prisma.TransactionClient;
type Run = { id: string; tenantId: string; deploymentId: string; input: Prisma.JsonValue };
type Deployment = { id: string; roleId: string; config: Prisma.JsonValue; limits: Prisma.JsonValue };

function sandbox(tx: Tx, tenantId: string): Sandbox {
 const where = (kind: string, key: string) => ({ tenantId_kind_key: { tenantId, kind, key } });
 const shape = (r: { key: string; data: Prisma.JsonValue; version: number }) => ({ key: r.key, data: r.data as Record<string, any>, version: r.version });
 return {
  async get(kind, key) { const r = await tx.sandboxRecord.findUnique({ where: where(kind, key) }); return r && shape(r); },
  async list(kind, limit = 100) { return (await tx.sandboxRecord.findMany({ where: { tenantId, kind }, orderBy: { key: 'asc' }, take: limit })).map(shape); },
  async put(kind, key, data) { return shape(await tx.sandboxRecord.upsert({ where: where(kind, key), create: { id: randomUUID(), tenantId, kind, key, data }, update: { data, version: { increment: 1 } } })); },
  async update(kind, key, version, data) {
   const changed = await tx.sandboxRecord.updateMany({ where: { tenantId, kind, key, version }, data: { data, version: { increment: 1 } } });
   if (!changed.count) throw new RolePolicyError('version_conflict');
   return { key, data, version: version + 1 };
  },
 };
}

export function classify(role: RoleDefinition, text: string) {
 if (INJECTION.test(text)) return 'unknown';
 return role.intents.find(i => i.pattern.test(text))?.id ?? 'unknown';
}

function stripSensitive(data: Record<string, unknown>, keys: string[] = []) {
 const deny = new Set(keys.map(k => k.toLowerCase()));
 return Object.fromEntries(Object.entries(data).filter(([k]) => !deny.has(k.toLowerCase())));
}

const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable((v as any)[k])}`).join(',')}}` : JSON.stringify(v);
const hash = (v: unknown) => createHash('sha256').update(stable(v)).digest('hex');

async function event(tx: Tx, run: Run, type: string, safePayload: Prisma.InputJsonValue = {}) {
 await tx.taskEvent.create({ data: { tenantId: run.tenantId, runId: run.id, type, safePayload } });
}

async function spentToday(tx: Tx, tenantId: string) {
 const today = new Date(); today.setUTCHours(0, 0, 0, 0);
 const agg = await tx.taskRun.aggregate({ where: { tenantId, startedAt: { gte: today } }, _sum: { costEstimate: true } });
 return Number(agg._sum.costEstimate ?? 0);
}

export async function runRole(tx: Tx, run: Run, deployment: Deployment, used: number, limits: { dailyRuns: number; alertAt: number }) {
 const role = ROLES[deployment.roleId];
 if (!role) throw new RolePolicyError('role_not_enabled');
 const config = deployment.config as { handoff_queue: string; locale?: string; n8n_tools?: string[] };
 const raw = run.input as { conversation_ref: string; intent_text: string; data?: Record<string, unknown>; locale?: string };
 const data = stripSensitive(raw.data ?? {}, role.sensitiveKeys) as Record<string, any>;
 const locale = ([raw.locale, config.locale].find(l => LOCALES.includes(l as Locale)) ?? 'pt-PT') as Locale;
 const sb = sandbox(tx, run.tenantId);
 const budget = Number(process.env.LLM_TENANT_DAILY_USD ?? 1);
 let cost = 0, effects = 0;
 const llmAllowed = async () => llmEnabled() && (await spentToday(tx, run.tenantId)) + cost < budget;

 let intent = classify(role, raw.intent_text);
 let source = 'rules';
 if (intent === 'unknown' && !INJECTION.test(raw.intent_text) && await llmAllowed()) {
  const r = await classifyIntent(role.name.en, role.intents.map(i => i.id), raw.intent_text);
  if (r) { cost += r.cost; if (r.confidence >= MIN_LLM_CONFIDENCE && r.intent !== 'unknown') { intent = r.intent; source = 'llm'; } }
 }
 await event(tx, run, 'intent.classified', { intent, source });

 const t = (key: string, vars?: Record<string, string | number>) => fill((role.replies[key] ?? commonReplies[key] ?? commonReplies.handoff)[locale], vars);
 const call = async (toolId: string, input: Record<string, any>): Promise<ToolOutcome> => {
  const spec = role.tools[toolId];
  if (!spec) throw new RolePolicyError('tool_unknown');
  if (spec.policy === 'forbidden') throw new RolePolicyError('forbidden_action');
  const parsed = spec.input.safeParse(input);
  if (!parsed.success) throw new RolePolicyError('invalid_tool_input');
  const granted = await tx.toolGrant.findFirst({ where: { tenantId: run.tenantId, deploymentId: run.deploymentId, toolId, enabled: true } });
  if (!granted) throw new RolePolicyError('tool_denied');
  await event(tx, run, 'tool.authorized', { toolId });
  const effectId = `${run.id}:${toolId}`;
  if (spec.effect) { const previous = await tx.toolEffect.findUnique({ where: { id: effectId } }); if (previous) return { status: 'ok', output: previous.result as Record<string, any> }; }
  if (spec.policy === 'approval') {
   // The approver sees a safe summary; execution later requires the exact same input (hash match).
   const inputHash = hash(parsed.data);
   const approval = await tx.approval.findUnique({ where: { runId: run.id } });
   if (!approval) {
    await tx.approval.create({ data: { tenantId: run.tenantId, runId: run.id, requestedAction: `tool:${toolId}`, safeContext: { toolId, inputHash, ...(spec.summary?.(parsed.data) ?? {}) }, assigneeId: config.handoff_queue, expiresAt: new Date(Date.now() + 3600000) } });
    await event(tx, run, 'human.requested', { reason: `tool:${toolId}` });
    return { status: 'pending' };
   }
   if (approval.requestedAction !== `tool:${toolId}` || (approval.safeContext as { inputHash?: string }).inputHash !== inputHash) return { status: 'rejected' };
   if (approval.state === 'pending') return { status: 'pending' };
   if (approval.state !== 'approved') return { status: 'rejected' };
  }
  let output: Record<string, any>;
  try {
   if (config.n8n_tools?.includes(toolId)) output = await callN8nTool({ tenantId: run.tenantId, deploymentId: run.deploymentId, runId: run.id }, role.packSlug, toolId, parsed.data);
   else if (spec.run) output = await spec.run({ sb, locale, runId: run.id, deploymentId: run.deploymentId }, parsed.data);
   else throw new RolePolicyError('tool_unavailable');
  } catch (e) {
   if (e instanceof RolePolicyError) throw e;
   throw new RolePolicyError(SAFE_TOOL_ERRORS.has((e as Error).message) ? (e as Error).message : 'tool_failed');
  }
  if (spec.effect) { effects++; await tx.toolEffect.create({ data: { id: effectId, tenantId: run.tenantId, runId: run.id, toolId, result: output } }); }
  await event(tx, run, 'tool.completed', { toolId });
  return { status: 'ok', output };
 };
 // Drafts are frozen per run, so what a human approves is exactly what is later sent.
 const draft = async (kind: string, facts: Record<string, string | number>, fallback: string) => {
  const cached = await sb.get('_draft', `${run.id}:${kind}`);
  if (cached) return String(cached.data.text);
  let text = fallback;
  if (await llmAllowed()) { const r = await draftText(kind, facts, locale); if (r) { cost += r.cost; text = r.text; } }
  await sb.put('_draft', `${run.id}:${kind}`, { text, by: text === fallback ? 'template' : 'llm' });
  return text;
 };
 const ctx: PlaybookContext = { intent, text: raw.intent_text, data, ref: raw.conversation_ref, locale, sb, call, t, draft };
 const finish: Finish = await role.playbook(ctx);
 await settle(tx, run, config, finish, { cost, effects, used, limits });
}

async function settle(tx: Tx, run: Run, config: { handoff_queue: string }, finish: Finish, m: { cost: number; effects: number; used: number; limits: { alertAt: number } }) {
 const minimal = { conversation_ref: (run.input as { conversation_ref: string }).conversation_ref };
 const costEstimate = m.cost;
 if (finish.state === 'awaiting_approval') { await tx.taskRun.update({ where: { id: run.id }, data: { state: 'awaiting_approval', costEstimate: { increment: costEstimate } } }); return; }
 if (finish.state === 'handoff') {
  const existing = await tx.approval.findUnique({ where: { runId: run.id } });
  const data = { requestedAction: `handoff:${finish.reason}`, safeContext: { reason: finish.reason }, assigneeId: config.handoff_queue, state: 'pending', resolvedAt: null, expiresAt: new Date(Date.now() + 3600000) };
  if (!existing) await tx.approval.create({ data: { tenantId: run.tenantId, runId: run.id, ...data } });
  else await tx.approval.update({ where: { id: existing.id }, data });
  await tx.taskRun.update({ where: { id: run.id }, data: { state: 'awaiting_approval', result: { reason: finish.reason, reply: finish.reply }, costEstimate: { increment: costEstimate } } });
  await event(tx, run, 'human.requested', { reason: finish.reason });
  return;
 }
 if (finish.state === 'blocked') {
  await tx.taskRun.update({ where: { id: run.id }, data: { state: 'blocked', result: { reason: finish.reason, reply: finish.reply }, input: minimal, costEstimate: { increment: costEstimate } } });
  await event(tx, run, 'policy.denied', { reason: finish.reason });
  return;
 }
 if (finish.state === 'cancelled') {
  await tx.taskRun.update({ where: { id: run.id }, data: { state: 'cancelled', result: { reply: finish.reply }, input: minimal, finishedAt: new Date(), costEstimate: { increment: costEstimate } } });
  return;
 }
 await tx.taskRun.update({ where: { id: run.id }, data: { state: 'completed', result: { reply: finish.reply, ...(finish.result ?? {}) }, input: minimal, finishedAt: new Date(), costEstimate: { increment: costEstimate } } });
 await tx.usageRecord.upsert({ where: { runId: run.id }, create: { tenantId: run.tenantId, runId: run.id, metric: 'role_action', quantity: Math.max(1, m.effects), unit: 'action', estimatedCost: costEstimate, currency: 'USD' }, update: {} });
 await event(tx, run, 'run.completed', { effects: m.effects });
 if (m.used + 1 >= m.limits.alertAt) await tx.incident.create({ data: { tenantId: run.tenantId, deploymentId: run.deploymentId, runId: run.id, severity: 'info', reason: 'quota_threshold' } });
}
