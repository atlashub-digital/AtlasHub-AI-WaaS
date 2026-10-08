import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { scoped } from '../../../packages/db/context.js';
import { ADAPTERS } from '../../../packages/commerce/payments.js';
import { db } from './executor.js';

type Tx = Prisma.TransactionClient;
const HOUSE = process.env.HOUSE_TENANT_ID ?? 'atlashub';
const addInterval = (d: Date, interval: string) => { const x = new Date(d); if (interval === 'month') x.setUTCMonth(x.getUTCMonth() + 1); else if (interval === 'quarter') x.setUTCMonth(x.getUTCMonth() + 3); else if (interval === 'year') x.setUTCFullYear(x.getUTCFullYear() + 1); return x; };
const finish = (id: string, status: string, error: string | null, tenantId: string | null = null) => scoped(db, { scope: 'worker' }, tx => tx.billingWebhookEvent.update({ where: { id }, data: { status, error, tenantId, processedAt: new Date(), attempts: { increment: 1 } } }));

// Payment webhook → re-read the payment from the provider → verify amount, currency and reference →
// mark paid and unlock what was bought. Idempotent: replays and out-of-order events change nothing twice.
export async function processWebhook(eventId: string) {
 const ev = await scoped(db, { scope: 'worker' }, tx => tx.billingWebhookEvent.findUnique({ where: { id: eventId } }));
 if (!ev || ev.status !== 'received' || !ev.providerRef) return;
 const adapter = ADAPTERS[ev.provider];
 const payment = await scoped(db, { scope: 'billing_webhook' }, tx => tx.billingPayment.findUnique({ where: { provider_providerRef: { provider: ev.provider, providerRef: ev.providerRef! } } }));
 if (!adapter || !payment) { await finish(ev.id, 'ignored', 'unknown_payment'); return; }
 const remote = await adapter.fetchPayment(ev.providerRef, ev.facts as Record<string, unknown>); // throws → BullMQ retry
 if (remote.amountMinor !== Number(payment.amountMinor) || remote.currency !== payment.currency || (remote.reference && remote.reference !== payment.id)) { await finish(ev.id, 'failed', 'payment_mismatch', payment.tenantId); return; }
 await scoped(db, { tenantId: payment.tenantId }, async tx => {
  const current = await tx.billingPayment.findUniqueOrThrow({ where: { id: payment.id } });
  if (remote.status === 'succeeded' && current.status === 'pending') await settle(tx, current.tenantId, current.id, current.invoiceId);
  else if (['failed', 'expired', 'refunded'].includes(remote.status) && current.status !== remote.status) await tx.billingPayment.update({ where: { id: current.id }, data: { status: remote.status } });
 });
 await finish(ev.id, 'processed', null, payment.tenantId);
}

async function settle(tx: Tx, tenantId: string, paymentId: string, invoiceId: string) {
 const now = new Date();
 await tx.billingPayment.update({ where: { id: paymentId }, data: { status: 'succeeded', paidAt: now } });
 const invoice = await tx.billingInvoice.update({ where: { id: invoiceId }, data: { status: 'paid', paidAt: now } });
 if (!invoice.orderId) return;
 await tx.commerceOrder.update({ where: { id: invoice.orderId }, data: { status: 'paid' } });
 const lines = await tx.billingInvoiceLine.findMany({ where: { tenantId, invoiceId } });
 const prices = await tx.catalogPrice.findMany({ where: { id: { in: lines.map(l => l.priceId!).filter(Boolean) } } });
 const products = await tx.catalogProduct.findMany({ where: { id: { in: prices.map(p => p.productId) } } });
 const subs = await tx.commerceSubscription.findMany({ where: { tenantId, orderId: invoice.orderId } });
 for (const line of lines) {
  const price = prices.find(p => p.id === line.priceId); const product = price && products.find(p => p.id === price.productId);
  if (!price || !product) continue;
  const periodEnd = price.interval === 'one_time' ? null : addInterval(now, price.interval);
  const sub = subs.find(s => s.priceId === price.id);
  if (sub) await tx.commerceSubscription.update({ where: { id: sub.id }, data: { status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd } });
  const key = product.templateId ? `mission.${product.templateId}` : `product.${product.id}`;
  await tx.commerceEntitlement.upsert({ where: { tenantId_key_source_sourceId: { tenantId, key, source: sub ? 'subscription' : 'order', sourceId: sub?.id ?? invoice.orderId } }, create: { id: randomUUID(), tenantId, key, source: sub ? 'subscription' : 'order', sourceId: sub?.id ?? invoice.orderId, quantity: line.quantity, validFrom: now, validUntil: periodEnd }, update: { status: 'active', validUntil: periodEnd } });
  // A paid mission enters provisioning; going live still requires acceptance tests and a human decision.
  if (product.kind === 'mission' && product.templateId) {
   const t = await tx.catalogMissionTemplate.findUniqueOrThrow({ where: { id: product.templateId } });
   await tx.commerceMission.upsert({ where: { tenantId_source_sourceId_templateId: { tenantId, source: 'order', sourceId: invoice.orderId, templateId: t.id } }, create: { id: randomUUID(), tenantId, templateId: t.id, kind: t.kind, capacity: t.capacity as Prisma.InputJsonValue, source: 'order', sourceId: invoice.orderId }, update: {} });
  }
 }
 await tx.commerceOrder.update({ where: { id: invoice.orderId }, data: { status: 'fulfilling' } });
 await tx.auditEvent.create({ data: { tenantId, actorId: 'billing', action: 'invoice.paid', objectId: invoiceId } });
}

// Trials end on time: entitlement expires, mission completes, the sales team sees it in the pipeline.
export async function expireTrials() {
 const due = await scoped(db, { scope: 'worker' }, tx => tx.commerceTrial.findMany({ where: { status: 'active', endsAt: { lt: new Date() } }, take: 50 }));
 for (const t of due) await scoped(db, { scope: 'platform', userId: 'trial-expiry' }, async tx => {
  const changed = await tx.commerceTrial.updateMany({ where: { id: t.id, status: 'active' }, data: { status: 'expired' } });
  if (!changed.count || !t.customerTenantId) return;
  await tx.commerceEntitlement.updateMany({ where: { tenantId: t.customerTenantId, source: 'trial', sourceId: t.id, status: 'active' }, data: { status: 'expired' } });
  await tx.commerceMission.updateMany({ where: { tenantId: t.customerTenantId, source: 'trial', sourceId: t.id }, data: { status: 'completed' } });
  await tx.crmActivity.create({ data: { id: randomUUID(), tenantId: HOUSE, leadId: t.leadId, kind: 'trial.expired', note: `trial=${t.id}`, actor: 'system' } });
 });
 return due.length;
}
