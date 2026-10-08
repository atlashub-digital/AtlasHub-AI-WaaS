import type { z } from 'zod';

export const LOCALES = ['pt-PT', 'pt-BR', 'en', 'es'] as const;
export type Locale = typeof LOCALES[number];

// auto: runs when granted · approval: a human must approve this run before it executes · forbidden: never executes.
export type ToolPolicy = 'auto' | 'approval' | 'forbidden';

export interface SandboxRecord { key: string; data: Record<string, any>; version: number }
// Stateful stand-in for the customer's external systems (CRM, mailbox, catalogue, orders, ledger, ATS).
// Every call is tenant-scoped by RLS and by an explicit tenantId filter in the engine.
export interface Sandbox {
 get(kind: string, key: string): Promise<SandboxRecord | null>;
 list(kind: string, limit?: number): Promise<SandboxRecord[]>;
 put(kind: string, key: string, data: Record<string, any>): Promise<SandboxRecord>;
 // Optimistic update: fails with version_conflict if the record changed since it was read.
 update(kind: string, key: string, version: number, data: Record<string, any>): Promise<SandboxRecord>;
}

export interface ToolContext { sb: Sandbox; locale: Locale; runId: string; deploymentId: string }
export interface ToolSpec {
 input: z.ZodType;
 policy: ToolPolicy;
 effect: boolean; // mutates an external system: recorded once per run (idempotent replay)
 run?: (ctx: ToolContext, input: any) => Promise<Record<string, any>>;
 summary?: (input: any) => Record<string, string | number | boolean>; // safe context shown to the approver
}

export type ToolOutcome = { status: 'ok'; output: Record<string, any> } | { status: 'pending' } | { status: 'rejected' };
export type Finish =
 | { state: 'completed'; reply: string; result?: Record<string, any> }
 | { state: 'blocked'; reason: string; reply: string }
 | { state: 'awaiting_approval' }
 | { state: 'cancelled'; reply: string }
 | { state: 'handoff'; reason: string; reply: string };

export interface PlaybookContext {
 intent: string;
 text: string;
 data: Record<string, any>;
 ref: string;
 locale: Locale;
 sb: Sandbox;
 call(toolId: string, input: Record<string, any>): Promise<ToolOutcome>;
 t(key: string, vars?: Record<string, string | number>): string;
 draft(kind: string, facts: Record<string, string | number>, fallback: string): Promise<string>;
}

export interface RoleDefinition {
 id: string;
 packId: string;
 packSlug: string;
 version: string;
 name: Record<Locale, string>;
 // First match wins; patterns cover pt, en and es. Unmatched text becomes 'unknown' (or the LLM classifier when enabled).
 intents: { id: string; pattern: RegExp }[];
 tools: Record<string, ToolSpec>;
 replies: Record<string, Record<Locale, string>>;
 sensitiveKeys?: string[]; // stripped from inbound data before any processing
 playbook(ctx: PlaybookContext): Promise<Finish>;
}
