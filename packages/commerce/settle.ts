import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
const addInterval = (d: Date, interval: string) => { const x = new Date(d); if (interval === 'month') x.setUTCMonth(x.getUTCMonth() + 1); else if (interval === 'quarter') x.setUTCMonth(x.getUTCMonth() + 3); else if (interval === 'year') x.setUTCFullYear(x.getUTCFullYear() + 1); return x; };

// Marks an invoice paid and unlocks what it bought: subscriptions, entitlements and missions (in provisioning).
// Used by the worker after a verified provider payment, and by the API for zero-total invoices (launch pricing).
// Going live still requires acceptance tests and a human decision.
export async function settleInvoice(tx: Tx, tenantId: string, invoiceId: string, paymentId: string | null, actor: string) {
 const now = new Date();
 if (paymentId) await tx.billingPayment.update({ where: { id: paymentId }, data: { status: 'succeeded', paidAt: now } });
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
  const source = sub ? 'subscription' : 'order'; const sourceId = sub?.id ?? invoice.orderId;
  await tx.commerceEntitlement.upsert({ where: { tenantId_key_source_sourceId: { tenantId, key, source, sourceId } }, create: { id: randomUUID(), tenantId, key, source, sourceId, quantity: line.quantity, validFrom: now, validUntil: periodEnd }, update: { status: 'active', validUntil: periodEnd } });
  if (product.kind === 'mission' && product.templateId) {
   const t = await tx.catalogMissionTemplate.findUniqueOrThrow({ where: { id: product.templateId } });
   await tx.commerceMission.upsert({ where: { tenantId_source_sourceId_templateId: { tenantId, source: 'order', sourceId: invoice.orderId, templateId: t.id } }, create: { id: randomUUID(), tenantId, templateId: t.id, kind: t.kind, capacity: t.capacity as Prisma.InputJsonValue, source: 'order', sourceId: invoice.orderId }, update: {} });
  }
 }
 await tx.commerceOrder.update({ where: { id: invoice.orderId }, data: { status: 'fulfilling' } });
 await tx.auditEvent.create({ data: { tenantId, actorId: actor, action: 'invoice.paid', objectId: invoiceId } });
}
