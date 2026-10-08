import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, ref, locale, handoffTool } from './common.js';

const invoice = z.object({ number: z.string().min(1).max(60), supplier: z.string().min(1).max(120), amount_minor: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const key = (supplier: string, number: string) => `${supplier.toLowerCase().replace(/\s+/g, '-')}:${number}`;

// ROLE-007 Assistente Financeiro Administrativo: registers invoices with duplicate detection,
// proposes (never confirms) bank reconciliations and drafts payment reminders that need approval.
// Moving funds is forbidden for this role.
export const financeAssistant: RoleDefinition = {
 id: 'ROLE-007', packId: 'PACK-007', packSlug: 'finance-assistant', version: '0.1.0',
 name: l('Assistente Financeiro Administrativo', 'Assistente Financeiro Administrativo', 'Finance Admin Assistant', 'Asistente Financiero Administrativo'),
 intents: [
  { id: 'transfer', pattern: /(transfer[eêi]|wire\b|pag(a|ar|ue) (ao|o|a la|al) fornecedor|pay the supplier|executa(r)? o pagamento|make the payment|realiza(r)? el pago|send money|enviar dinheiro|pix para)/i },
  { id: 'reconcile', pattern: /(concilia|reconcil|extrato|bank statement|movimentos|extracto)/i },
  { id: 'reminder', pattern: /(lembrete|reminder|cobran[çc]a|cobrar|recordatorio|overdue|em atraso|vencid|atrasad)/i },
  { id: 'register', pattern: /(fatura|factura|invoice|registar|registrar|register|lan[çc]ar|nota fiscal)/i },
 ],
 tools: {
  'invoice.register': {
   input: invoice, policy: 'auto', effect: true,
   async run({ sb }, i) { const k = key(i.supplier, i.number); if (await sb.get('invoice', k)) throw new Error('duplicate_invoice'); await sb.put('invoice', k, { ...i, status: 'registered' }); return { key: k, status: 'registered' }; },
  },
  'reconcile.match': {
   input: z.object({ invoice_key: z.string().min(1).max(200) }).strict(), policy: 'auto', effect: true,
   async run({ sb }, i) {
    const inv = await sb.get('invoice', i.invoice_key); if (!inv) throw new Error('record_missing');
    const line = (await sb.list('bank_line', 500)).find(b => !b.data.matched && b.data.amount_minor === inv.data.amount_minor && b.data.currency === inv.data.currency && String(b.data.reference ?? '').includes(inv.data.number));
    if (!line) return { match: null };
    // Preliminary: a person confirms the match before the books change.
    await sb.update('invoice', i.invoice_key, inv.version, { ...inv.data, status: 'match_proposed', bank_line: line.key });
    return { match: line.key, status: 'match_proposed' };
   },
  },
  'reminder.send': {
   input: z.object({ customer_ref: ref, invoice_key: z.string().min(1).max(200), locale }).strict(), policy: 'approval', effect: true,
   summary: i => ({ customer: i.customer_ref, invoice: i.invoice_key }),
   async run({ sb, runId }, i) { await sb.put('outbox', `${i.customer_ref}:${runId}`, { channel: 'email', template: 'payment_reminder', ...i, status: 'queued' }); return { queued: true }; },
  },
  'payment.transfer': { input: z.object({ invoice_key: z.string() }).strict(), policy: 'forbidden', effect: true },
  'team.handoff': handoffTool,
 },
 replies: {
  registered: l('Fatura {number} de {supplier} registada.', 'Fatura {number} de {supplier} registrada.', 'Invoice {number} from {supplier} registered.', 'Factura {number} de {supplier} registrada.'),
  duplicate: l('Esta fatura já estava registada; não foi duplicada.', 'Esta fatura já estava registrada; não foi duplicada.', 'This invoice was already registered; it was not duplicated.', 'Esta factura ya estaba registrada; no se ha duplicado.'),
  match: l('Proposta de conciliação: fatura {number} ↔ movimento {line}. Aguarda confirmação da equipa.', 'Proposta de conciliação: fatura {number} ↔ lançamento {line}. Aguarda confirmação da equipe.', 'Reconciliation proposal: invoice {number} ↔ bank line {line}. Awaiting team confirmation.', 'Propuesta de conciliación: factura {number} ↔ movimiento {line}. Pendiente de confirmación del equipo.'),
  no_match: l('Não encontrei movimento bancário correspondente; a equipa vai verificar.', 'Não encontrei lançamento bancário correspondente; a equipe vai verificar.', 'No matching bank line found; the team will check.', 'No encontré un movimiento bancario correspondiente; el equipo lo revisará.'),
  reminder: l('Lembrete de pagamento enviado.', 'Lembrete de pagamento enviado.', 'Payment reminder sent.', 'Recordatorio de pago enviado.'),
  invalid: l('Os dados da fatura estão incompletos ou inválidos.', 'Os dados da fatura estão incompletos ou inválidos.', 'The invoice details are incomplete or invalid.', 'Los datos de la factura están incompletos o no son válidos.'),
 },
 async playbook(c) {
  if (c.intent === 'transfer') return { state: 'blocked', reason: 'forbidden_action', reply: c.t('forbidden') };
  if (c.intent === 'unknown') return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') };
  const inv = invoice.safeParse(c.data.invoice);
  if (!inv.success) return { state: 'blocked', reason: 'invalid_invoice', reply: c.t('invalid') };
  const k = key(inv.data.supplier, inv.data.number);
  if (c.intent === 'register') {
   if (await c.sb.get('invoice', k)) return { state: 'completed', reply: c.t('duplicate'), result: { duplicate: true } };
   await c.call('invoice.register', inv.data);
   return { state: 'completed', reply: c.t('registered', { number: inv.data.number, supplier: inv.data.supplier }), result: { key: k } };
  }
  if (!(await c.sb.get('invoice', k))) await c.call('invoice.register', inv.data);
  if (c.intent === 'reconcile') {
   const m = await c.call('reconcile.match', { invoice_key: k });
   if (m.status !== 'ok' || !m.output.match) return { state: 'handoff', reason: 'no_match', reply: c.t('no_match') };
   return { state: 'completed', reply: c.t('match', { number: inv.data.number, line: m.output.match }), result: m.output };
  }
  const customer = String(c.data.customer_ref ?? '');
  if (!ref.safeParse(customer).success) return { state: 'blocked', reason: 'customer_missing', reply: c.t('invalid') };
  const r = await c.call('reminder.send', { customer_ref: customer, invoice_key: k, locale: c.locale });
  if (r.status === 'pending') return { state: 'awaiting_approval' };
  if (r.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
  return { state: 'completed', reply: c.t('reminder'), result: { queued: true } };
 },
};
