import { z } from 'zod';
import type { RoleDefinition } from './types.js';
import { l, handoffTool } from './common.js';

const order = z.string().min(1).max(60);
const email = z.string().email().max(200);
const RETURN_DAYS = 30;

// ROLE-005 Assistente E-commerce: order status after identity verification (order number + email),
// shipping FAQ, returns inside the policy window. Refunds always need human approval; the
// assistant never moves money and never reveals data before verification.
export const ecommerceAssistant: RoleDefinition = {
 id: 'ROLE-005', packId: 'PACK-005', packSlug: 'ecommerce-assistant', version: '0.1.0',
 name: l('Assistente E-commerce', 'Assistente E-commerce', 'E-commerce Assistant', 'Asistente E-commerce'),
 intents: [
  { id: 'refund', pattern: /(reembols|refund|estorno|devolu[çc][ãa]o do (dinheiro|valor)|money back|devolver el dinero)/i },
  { id: 'return', pattern: /(devolver|devolu[çc]|devoluci|return|troca\b|trocar|exchange|cambiar|cambio\b)/i },
  { id: 'status', pattern: /(onde est|where is|d[óo]nde est|estado|status|tracking|rastreio|seguimiento|encomenda|pedido|order\b|chegou|arrived|lleg[óo])/i },
  { id: 'shipping', pattern: /(prazo|envio|shipping|portes|frete|entrega|delivery|env[íi]o|plazo)/i },
 ],
 tools: {
  'order.lookup': {
   input: z.object({ order_number: order, email }).strict(), policy: 'auto', effect: false,
   async run({ sb }, i) {
    const o = await sb.get('order', i.order_number);
    // Same answer for "no such order" and "email does not match": no enumeration of orders.
    if (!o || String(o.data.email).toLowerCase() !== i.email.toLowerCase()) throw new Error('verification_failed');
    return { status: o.data.status, carrier: o.data.carrier ?? null, delivered_at: o.data.delivered_at ?? null, total: o.data.total, currency: o.data.currency, refund: o.data.refund ?? null, rma: o.data.rma ?? null };
   },
  },
  'faq.answer': {
   input: z.object({ topic: z.enum(['shipping', 'returns']) }).strict(), policy: 'auto', effect: false,
   async run({ sb }, i) { const f = await sb.get('faq', i.topic); return { known: !!f }; },
  },
  'return.create': {
   input: z.object({ order_number: order }).strict(), policy: 'auto', effect: true,
   async run({ sb, runId }, i) { const o = await sb.get('order', i.order_number); if (!o) throw new Error('record_missing'); if (o.data.rma) return { rma: o.data.rma }; const rma = `RMA-${runId.slice(0, 8)}`; await sb.update('order', i.order_number, o.version, { ...o.data, rma }); return { rma }; },
  },
  'refund.request': {
   input: z.object({ order_number: order, amount_minor: z.number().int().positive(), currency: z.string().length(3) }).strict(), policy: 'approval', effect: true,
   summary: i => ({ order: i.order_number, amount_minor: i.amount_minor, currency: i.currency }),
   // Records the approved request for finance; the money movement itself stays with a human.
   async run({ sb }, i) { const o = await sb.get('order', i.order_number); if (!o) throw new Error('record_missing'); await sb.update('order', i.order_number, o.version, { ...o.data, refund: 'approved_pending_finance' }); return { refund: 'approved_pending_finance' }; },
  },
  'payment.refund_execute': { input: z.object({ order_number: order }).strict(), policy: 'forbidden', effect: true },
  'team.handoff': handoffTool,
 },
 replies: {
  verify: l('Para sua segurança, indique o número da encomenda e o email usado na compra.', 'Para sua segurança, informe o número do pedido e o email usado na compra.', 'For your security, please provide the order number and the email used for the purchase.', 'Por su seguridad, indique el número de pedido y el email usado en la compra.'),
  status: l('A sua encomenda {order} está no estado: {status}.', 'Seu pedido {order} está com status: {status}.', 'Your order {order} status is: {status}.', 'Su pedido {order} está en estado: {status}.'),
  shipping: l('As encomendas são enviadas em 1–2 dias úteis; a entrega demora normalmente 2–5 dias úteis.', 'Os pedidos são enviados em 1–2 dias úteis; a entrega costuma levar 2–5 dias úteis.', 'Orders ship within 1–2 business days; delivery usually takes 2–5 business days.', 'Los pedidos se envían en 1–2 días laborables; la entrega suele tardar 2–5 días laborables.'),
  return_ok: l('Devolução aberta com a referência {rma}. Enviámos as instruções por email.', 'Devolução aberta com a referência {rma}. Enviamos as instruções por email.', 'Return opened with reference {rma}. Instructions have been emailed to you.', 'Devolución abierta con la referencia {rma}. Le hemos enviado las instrucciones por email.'),
  refund_ok: l('O reembolso foi aprovado e será processado pela equipa financeira.', 'O reembolso foi aprovado e será processado pela equipe financeira.', 'The refund was approved and will be processed by the finance team.', 'El reembolso fue aprobado y lo procesará el equipo financiero.'),
 },
 async playbook(c) {
  if (c.intent === 'shipping') { await c.call('faq.answer', { topic: 'shipping' }); return { state: 'completed', reply: c.t('shipping') }; }
  if (c.intent === 'unknown') return { state: 'handoff', reason: 'unknown', reply: c.t('handoff') };
  const creds = { order_number: String(c.data.order_number ?? ''), email: String(c.data.email ?? '') };
  if (!order.safeParse(creds.order_number).success || !email.safeParse(creds.email).success) return { state: 'blocked', reason: 'verification_required', reply: c.t('verify') };
  const o = await c.call('order.lookup', creds).catch(() => null);
  if (!o || o.status !== 'ok') return { state: 'blocked', reason: 'verification_failed', reply: c.t('verify') };
  if (c.intent === 'status') return { state: 'completed', reply: c.t('status', { order: creds.order_number, status: o.output.status }), result: { status: o.output.status } };
  if (c.intent === 'return') {
   const inWindow = o.output.status === 'delivered' && o.output.delivered_at && Date.now() - Date.parse(o.output.delivered_at) <= RETURN_DAYS * 864e5;
   if (!inWindow) return { state: 'handoff', reason: 'return_outside_policy', reply: c.t('handoff') };
   const r = await c.call('return.create', { order_number: creds.order_number });
   return { state: 'completed', reply: c.t('return_ok', { rma: r.status === 'ok' ? r.output.rma : '' }), result: { rma: r.status === 'ok' ? r.output.rma : null } };
  }
  const refund = await c.call('refund.request', { order_number: creds.order_number, amount_minor: o.output.total, currency: o.output.currency });
  if (refund.status === 'pending') return { state: 'awaiting_approval' };
  if (refund.status === 'rejected') return { state: 'cancelled', reply: c.t('rejected') };
  return { state: 'completed', reply: c.t('refund_ok'), result: { refund: refund.output.refund } };
 },
};
