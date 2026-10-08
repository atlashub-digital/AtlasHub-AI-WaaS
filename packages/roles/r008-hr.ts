import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, ref, slotId, handoffTool } from './common.js';

const position = z.string().min(1).max(80);
// Attributes that must never reach screening, storage or any tool (anti-discrimination).
const SENSITIVE = ['age', 'idade', 'edad', 'birth_date', 'data_nascimento', 'gender', 'genero', 'género', 'sexo', 'sex', 'race', 'raca', 'raza', 'ethnicity', 'religion', 'religiao', 'religión', 'nationality', 'nacionalidade', 'marital_status', 'estado_civil', 'pregnancy', 'gravidez', 'disability', 'deficiencia', 'health', 'saude', 'photo', 'foto', 'political', 'union', 'sindicato', 'sexual_orientation'];

// ROLE-008 Assistente de RH: receives applications with consent, answers process questions and
// schedules interviews with approval. It never ranks, scores, rejects or hires candidates.
export const hrAssistant: RoleDefinition = {
 id: 'ROLE-008', packId: 'PACK-008', packSlug: 'hr-assistant', version: '0.1.0',
 name: l('Assistente de RH', 'Assistente de RH', 'HR Assistant', 'Asistente de RR. HH.'),
 sensitiveKeys: SENSITIVE,
 intents: [
  { id: 'decision', pattern: /(rank|ranking|classific|ordena|melhor candidat|best candidate|mejor candidat|score|pontua|puntua|descart|reject|rejeit|rechaz|aprova(r)? o candidat|contrat(a|ar|e)\b|hire\b|shortlist|pr[ée]-?sele)/i },
  { id: 'interview', pattern: /(entrevista|interview|agendar|marcar|schedule)/i },
  { id: 'apply', pattern: /(candidat|apply|aplicar|postular|\bcv\b|curr[íi]cul|resume|vaga|vacante|job\b|emprego|empleo|trabalh)/i },
  { id: 'faq', pattern: /(processo|process|proceso|prazo|etapas|steps|fases|sal[áa]rio|salary|benef[íi]cio|benefit|remoto|remote|hor[áa]rio|horario)/i },
 ],
 tools: {
  'application.register': {
   input: z.object({ candidate_ref: ref, position, availability: z.string().max(120).optional(), consent: z.literal(true) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { const k = `${i.candidate_ref}:${i.position}`; const prev = await sb.get('application', k); if (prev) return { key: k, status: prev.data.status }; await sb.put('application', k, { ...i, status: 'received' }); return { key: k, status: 'received' }; },
  },
  'faq.answer': { input: z.object({ topic: z.enum(['process']) }).strict(), policy: 'auto', effect: false, async run() { return { ok: true }; } },
  'interview.find_slots': {
   input: z.object({}).strict(), policy: 'auto', effect: false,
   async run({ sb }) { return { slots: (await sb.list('slot', 50)).filter(s => !s.data.booked && Date.parse(s.data.starts_at) > Date.now()).slice(0, 3).map(s => ({ id: s.key, starts_at: s.data.starts_at })) }; },
  },
  'interview.schedule': {
   input: z.object({ application_key: z.string().min(1).max(200), slot: slotId }).strict(), policy: 'approval', effect: true,
   summary: i => ({ application: i.application_key, slot: i.slot }),
   async run({ sb }, i) { const s = await sb.get('slot', i.slot); if (!s || s.data.booked) throw new Error('slot_conflict'); await sb.update('slot', i.slot, s.version, { ...s.data, booked: true, application: i.application_key }); const a = await sb.get('application', i.application_key); if (a) await sb.update('application', i.application_key, a.version, { ...a.data, status: 'interview_scheduled' }); return { scheduled: true, starts_at: s.data.starts_at }; },
  },
  'candidate.rank': { input: z.object({ position }).strict(), policy: 'forbidden', effect: false },
  'team.handoff': handoffTool,
 },
 replies: {
  received: l('Recebemos a sua candidatura para {position}. A equipa de recrutamento vai analisá-la.', 'Recebemos sua candidatura para {position}. A equipe de recrutamento vai analisá-la.', 'We have received your application for {position}. The recruiting team will review it.', 'Hemos recibido su candidatura para {position}. El equipo de selección la revisará.'),
  faq: l('O processo tem três etapas: análise da candidatura, entrevista e decisão final, sempre feitas por pessoas da equipa.', 'O processo tem três etapas: análise da candidatura, entrevista e decisão final, sempre feitas por pessoas da equipe.', 'The process has three stages: application review, interview and final decision, always made by people on the team.', 'El proceso tiene tres fases: revisión de la candidatura, entrevista y decisión final, siempre a cargo de personas del equipo.'),
  interview: l('Entrevista marcada para {starts_at}.', 'Entrevista marcada para {starts_at}.', 'Interview scheduled for {starts_at}.', 'Entrevista programada para el {starts_at}.'),
  decision: l('Decisões sobre candidatos são sempre tomadas por pessoas. O pedido foi encaminhado para a equipa de recrutamento.', 'Decisões sobre candidatos são sempre tomadas por pessoas. O pedido foi encaminhado para a equipe de recrutamento.', 'Decisions about candidates are always made by people. The request has been passed to the recruiting team.', 'Las decisiones sobre candidatos siempre las toman personas. La solicitud se ha pasado al equipo de selección.'),
 },
 async playbook(c) {
  if (c.intent === 'decision') return { state: 'blocked', reason: 'forbidden_action', reply: c.t('decision') };
  if (c.intent === 'faq') { await c.call('faq.answer', { topic: 'process' }); return { state: 'completed', reply: c.t('faq') }; }
  if (c.intent === 'unknown') return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') };
  if (c.data.consent !== true) return { state: 'blocked', reason: 'consent_missing', reply: c.t('consent') };
  const pos = position.safeParse(c.data.position);
  if (!pos.success) return { state: 'handoff', reason: 'missing_position', reply: c.t('handoff') };
  const app = await c.call('application.register', { candidate_ref: c.ref, position: pos.data, consent: true, ...(typeof c.data.availability === 'string' ? { availability: c.data.availability.slice(0, 120) } : {}) });
  if (app.status !== 'ok') return { state: 'blocked', reason: 'ats_unavailable', reply: c.t('handoff') };
  if (c.intent === 'apply') return { state: 'completed', reply: c.t('received', { position: pos.data }), result: { application: app.output.key } };
  const found = await c.call('interview.find_slots', {});
  const slot = found.status === 'ok' ? found.output.slots[0] as { id: string } | undefined : undefined;
  if (!slot) return { state: 'handoff', reason: 'no_slots', reply: c.t('handoff') };
  const s = await c.call('interview.schedule', { application_key: app.output.key, slot: slot.id });
  if (s.status === 'pending') return { state: 'awaiting_approval' };
  if (s.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
  return { state: 'completed', reply: c.t('interview', { starts_at: s.output.starts_at }), result: { slot: slot.id } };
 },
};
