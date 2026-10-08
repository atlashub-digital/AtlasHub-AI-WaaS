import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, slotId, locale, handoffTool } from './common.js';

const messageId = z.string().min(1).max(120);

// ROLE-003 Secretária Administrativa: triages the inbox, drafts replies and holds meeting slots.
// Draft-only: sending email is forbidden for this role; holding a calendar slot requires approval.
export const administrativeSecretary: RoleDefinition = {
 id: 'ROLE-003', packId: 'PACK-003', packSlug: 'administrative-secretary', version: '0.2.0',
 name: l('Secretária Administrativa', 'Secretária Administrativa', 'Administrative Assistant', 'Secretaria Administrativa'),
 intents: [
  { id: 'meeting', pattern: /(reuni|meeting|agend|marcar|call\b|cita\b|encontro|disponibilidade|availability|disponibilidad)/i },
  { id: 'finance', pattern: /(fatura|factura|invoice|pagamento|payment|pago\b|boleto|recibo|receipt|nota fiscal)/i },
  { id: 'general', pattern: /\S/ },
 ],
 tools: {
  'mail.read': {
   input: z.object({ message_id: messageId }).strict(), policy: 'auto', effect: false,
   async run({ sb }, i) { const m = await sb.get('mail', i.message_id); if (!m) throw new Error('record_missing'); return { subject: m.data.subject, from_domain: m.data.from_domain, labels: m.data.labels ?? [] }; },
  },
  'mail.label': {
   input: z.object({ message_id: messageId, label: z.enum(['meeting', 'finance', 'general', 'needs_human']) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { const m = await sb.get('mail', i.message_id); if (!m) throw new Error('record_missing'); const labels = [...new Set([...(m.data.labels ?? []), i.label])]; await sb.update('mail', i.message_id, m.version, { ...m.data, labels }); return { labels }; },
  },
  'mail.draft_reply': {
   input: z.object({ message_id: messageId, locale, text: z.string().min(1).max(2000) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { await sb.put('draft_reply', i.message_id, { ...i, status: 'draft' }); return { drafted: true }; },
  },
  'mail.send': { input: z.object({ message_id: messageId }).strict(), policy: 'forbidden', effect: true },
  'calendar.find_slots': {
   input: z.object({}).strict(), policy: 'auto', effect: false,
   async run({ sb }) { return { slots: (await sb.list('slot', 50)).filter(s => !s.data.booked && Date.parse(s.data.starts_at) > Date.now()).slice(0, 3).map(s => ({ id: s.key, starts_at: s.data.starts_at })) }; },
  },
  'calendar.hold': {
   input: z.object({ message_id: messageId, slot: slotId }).strict(), policy: 'approval', effect: true,
   summary: i => ({ message: i.message_id, slot: i.slot }),
   async run({ sb }, i) { const s = await sb.get('slot', i.slot); if (!s || s.data.booked) throw new Error('slot_conflict'); await sb.update('slot', i.slot, s.version, { ...s.data, booked: true, hold_for: i.message_id }); return { held: true, starts_at: s.data.starts_at }; },
  },
  'brief.create': {
   input: z.object({ message_id: messageId, summary: z.string().min(1).max(500) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) { await sb.put('brief', i.message_id, i); return { created: true }; },
  },
  'team.handoff': handoffTool,
 },
 replies: {
  meeting_draft: l('Obrigado pela mensagem. Proponho {starts_at}; confirma que lhe convém?', 'Obrigado pela mensagem. Proponho {starts_at}; confirma se fica bom para você?', 'Thank you for your message. I propose {starts_at}; does that work for you?', 'Gracias por su mensaje. Propongo el {starts_at}; ¿le viene bien?'),
  general_draft: l('Obrigado pela sua mensagem sobre "{subject}". Iremos analisá-la e responder em breve.', 'Obrigado pela sua mensagem sobre "{subject}". Vamos analisá-la e responder em breve.', 'Thank you for your message about "{subject}". We will review it and reply shortly.', 'Gracias por su mensaje sobre "{subject}". Lo revisaremos y responderemos en breve.'),
  drafted: l('Rascunho de resposta preparado para revisão.', 'Rascunho de resposta preparado para revisão.', 'Reply draft prepared for review.', 'Borrador de respuesta preparado para revisión.'),
 },
 async playbook(c) {
  const id = String(c.data.message_id ?? '');
  const mail = id ? await c.call('mail.read', { message_id: id }).catch(() => null) : null;
  if (!mail || mail.status !== 'ok') return { state: 'blocked', reason: 'record_missing', reply: c.t('not_found') };
  if (c.intent === 'unknown') { await c.call('mail.label', { message_id: id, label: 'needs_human' }); return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') }; }
  if (c.intent === 'finance') {
   await c.call('mail.label', { message_id: id, label: 'finance' });
   await c.call('brief.create', { message_id: id, summary: `Finance email from ${mail.output.from_domain}: ${String(mail.output.subject).slice(0, 200)}` });
   return { state: 'handoff', reason: 'finance_review', reply: c.t('handoff') };
  }
  if (c.intent === 'meeting') {
   await c.call('mail.label', { message_id: id, label: 'meeting' });
   const found = await c.call('calendar.find_slots', {});
   const slot = found.status === 'ok' ? found.output.slots[0] as { id: string; starts_at: string } | undefined : undefined;
   if (!slot) return { state: 'handoff', reason: 'no_slots', reply: c.t('handoff') };
   const hold = await c.call('calendar.hold', { message_id: id, slot: slot.id });
   if (hold.status === 'pending') return { state: 'awaiting_approval' };
   if (hold.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
   await c.call('mail.draft_reply', { message_id: id, locale: c.locale, text: c.t('meeting_draft', { starts_at: hold.output.starts_at }) });
   return { state: 'completed', reply: c.t('drafted'), result: { slot: slot.id, draft: true } };
  }
  await c.call('mail.label', { message_id: id, label: 'general' });
  const subject = String(mail.output.subject).slice(0, 120);
  const text = await c.draft('email_reply', { subject }, c.t('general_draft', { subject }));
  await c.call('mail.draft_reply', { message_id: id, locale: c.locale, text });
  await c.call('brief.create', { message_id: id, summary: `Reply drafted for "${subject}"` });
  return { state: 'completed', reply: c.t('drafted'), result: { draft: true } };
 },
};
