import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, ref, slotId, locale, handoffTool, leadScore } from './common.js';

// ROLE-002 Assistente Comercial: qualifies inbound leads, keeps the CRM tidy, books meetings and
// prepares follow-ups. Every outbound message and every meeting requires human approval.
export const salesAssistant: RoleDefinition = {
 id: 'ROLE-002', packId: 'PACK-002', packSlug: 'sales-assistant', version: '0.2.0',
 name: l('Assistente Comercial', 'Assistente Comercial', 'Sales Assistant', 'Asistente Comercial'),
 intents: [
  { id: 'opt_out', pattern: /\b(stop|parar|remover|remova|unsubscribe|baja|n[ãa]o quero|no quiero|sair da lista)\b/i },
  { id: 'meeting', pattern: /(reuni|agend|marcar|demo\b|call\b|meeting|chamada|cita\b|videoconfer)/i },
  { id: 'qualify', pattern: /(pre[çc]o|price|precio|interess|interest|or[çc]amento|budget|presupuesto|proposta|quote|cotiza|plano|plan\b|informa)/i },
 ],
 tools: {
  'crm.upsert_lead': {
   input: z.object({ ref, company: z.string().max(120).optional(), size: z.enum(['micro', 'small', 'medium', 'large']).optional(), budget: z.enum(['none', 'low', 'medium', 'high']).optional(), timeline: z.enum(['now', 'quarter', 'later']).optional(), interest: z.string().max(200).optional() }).strict(),
   policy: 'auto', effect: true,
   async run({ sb }, i) { const score = leadScore(i); const prev = await sb.get('lead', i.ref); const data = { ...(prev?.data ?? {}), ...i, score, status: score >= 60 ? 'qualified' : 'nurture' }; return { ...(await sb.put('lead', i.ref, data)).data }; },
  },
  'crm.log_activity': {
   input: z.object({ ref, kind: z.enum(['inbound', 'qualification', 'meeting', 'followup', 'opt_out']), note: z.string().max(200) }).strict(),
   policy: 'auto', effect: true,
   async run({ sb, runId }, i) { await sb.put('activity', `${i.ref}:${runId}:${i.kind}`, i); return { logged: true }; },
  },
  'crm.suppress': {
   input: z.object({ ref }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { await sb.put('suppression', i.ref, { at: new Date().toISOString() }); const lead = await sb.get('lead', i.ref); if (lead) await sb.update('lead', i.ref, lead.version, { ...lead.data, status: 'opted_out' }); return { suppressed: true }; },
  },
  'calendar.find_slots': {
   input: z.object({}).strict(), policy: 'auto', effect: false,
   async run({ sb }) { return { slots: (await sb.list('slot', 50)).filter(s => !s.data.booked && Date.parse(s.data.starts_at) > Date.now()).slice(0, 3).map(s => ({ id: s.key, starts_at: s.data.starts_at })) }; },
  },
  'calendar.book_meeting': {
   input: z.object({ ref, slot: slotId }).strict(), policy: 'approval', effect: true,
   summary: i => ({ lead: i.ref, slot: i.slot }),
   async run({ sb }, i) { const s = await sb.get('slot', i.slot); if (!s || s.data.booked) throw new Error('slot_conflict'); await sb.update('slot', i.slot, s.version, { ...s.data, booked: true, lead: i.ref }); return { booked: true, starts_at: s.data.starts_at }; },
  },
  'message.send_followup': {
   input: z.object({ ref, locale, text: z.string().min(1).max(1200) }).strict(), policy: 'approval', effect: true,
   summary: i => ({ lead: i.ref, locale: i.locale, preview: i.text.slice(0, 160) }),
   async run({ sb, runId }, i) { await sb.put('outbox', `${i.ref}:${runId}`, { channel: 'email', ...i, status: 'queued' }); return { queued: true }; },
  },
  'team.handoff': handoffTool,
 },
 replies: {
  opt_out: l('Removemos o seu contacto. Não voltará a receber mensagens nossas.', 'Removemos seu contato. Você não receberá mais mensagens nossas.', 'Your contact has been removed. You will not receive further messages from us.', 'Hemos eliminado su contacto. No recibirá más mensajes nuestros.'),
  suppressed: l('Este contacto pediu para não ser contactado.', 'Este contato pediu para não ser contatado.', 'This contact asked not to be contacted.', 'Este contacto pidió no ser contactado.'),
  followup: l('Olá {company}, obrigado pelo interesse. Preparámos uma proposta à medida; podemos marcar 20 minutos para a apresentar?', 'Olá {company}, obrigado pelo interesse. Preparamos uma proposta sob medida; podemos marcar 20 minutos para apresentá-la?', 'Hi {company}, thank you for your interest. We have prepared a tailored proposal; could we book 20 minutes to walk you through it?', 'Hola {company}, gracias por su interés. Hemos preparado una propuesta a medida; ¿podemos reservar 20 minutos para presentarla?'),
  followup_sent: l('Obrigado! A nossa equipa enviou-lhe a proposta por email.', 'Obrigado! Nossa equipe enviou a proposta por email.', 'Thank you! Our team has emailed you the proposal.', '¡Gracias! Nuestro equipo le ha enviado la propuesta por email.'),
  nurture: l('Obrigado! Registámos o seu interesse e enviaremos informação útil.', 'Obrigado! Registramos seu interesse e enviaremos informações úteis.', 'Thank you! We have noted your interest and will share useful information.', '¡Gracias! Hemos registrado su interés y le enviaremos información útil.'),
  meeting_booked: l('Reunião confirmada para {starts_at}.', 'Reunião confirmada para {starts_at}.', 'Meeting confirmed for {starts_at}.', 'Reunión confirmada para el {starts_at}.'),
 },
 async playbook(c) {
  if (await c.sb.get('suppression', c.ref)) return { state: 'completed', reply: c.t('suppressed'), result: { suppressed: true } };
  if (c.intent === 'opt_out') {
   await c.call('crm.suppress', { ref: c.ref });
   await c.call('crm.log_activity', { ref: c.ref, kind: 'opt_out', note: 'contact requested removal' });
   return { state: 'completed', reply: c.t('opt_out') };
  }
  if (c.intent === 'unknown') return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') };
  if (c.data.consent !== true) return { state: 'blocked', reason: 'consent_missing', reply: c.t('consent') };
  const fit = { company: c.data.company, size: c.data.size, budget: c.data.budget, timeline: c.data.timeline, interest: c.data.interest };
  const lead = await c.call('crm.upsert_lead', { ref: c.ref, ...Object.fromEntries(Object.entries(fit).filter(([, v]) => v !== undefined)) });
  if (lead.status !== 'ok') return { state: 'blocked', reason: 'crm_unavailable', reply: c.t('handoff') };
  if (c.intent === 'meeting') {
   const found = await c.call('calendar.find_slots', {});
   const slots = found.status === 'ok' ? found.output.slots as { id: string; starts_at: string }[] : [];
   const slot = slots.find(s => s.id === c.data.slot) ?? slots[0];
   if (!slot) return { state: 'handoff', reason: 'no_slots', reply: c.t('handoff') };
   const booked = await c.call('calendar.book_meeting', { ref: c.ref, slot: slot.id });
   if (booked.status === 'pending') return { state: 'awaiting_approval' };
   if (booked.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
   await c.call('crm.log_activity', { ref: c.ref, kind: 'meeting', note: `slot ${slot.id}` });
   return { state: 'completed', reply: c.t('meeting_booked', { starts_at: booked.output.starts_at }), result: { slot: slot.id } };
  }
  await c.call('crm.log_activity', { ref: c.ref, kind: 'qualification', note: `score ${lead.output.score}` });
  if (lead.output.status !== 'qualified') return { state: 'completed', reply: c.t('nurture'), result: { score: lead.output.score, status: 'nurture' } };
  const company = String(c.data.company ?? '').slice(0, 80);
  const text = await c.draft('sales_followup', { company, interest: String(c.data.interest ?? '') }, c.t('followup', { company }));
  const sent = await c.call('message.send_followup', { ref: c.ref, locale: c.locale, text });
  if (sent.status === 'pending') return { state: 'awaiting_approval' };
  if (sent.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
  await c.call('crm.log_activity', { ref: c.ref, kind: 'followup', note: 'approved follow-up queued' });
  return { state: 'completed', reply: c.t('followup_sent'), result: { score: lead.output.score, status: 'qualified' } };
 },
};
