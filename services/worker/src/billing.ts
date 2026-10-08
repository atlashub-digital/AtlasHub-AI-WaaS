import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { scoped } from '../../../packages/db/context.js';
import { ADAPTERS } from '../../../packages/commerce/payments.js';
import { settleInvoice } from '../../../packages/commerce/settle.js';
import { renderInvoiceHtml } from '../../../packages/commerce/invoice.js';
import { asLocale } from '../../../packages/commerce/i18n.js';
import { db } from './executor.js';

type Tx = Prisma.TransactionClient;
const HOUSE = process.env.HOUSE_TENANT_ID ?? 'atlashub';
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
  if (remote.status === 'succeeded' && current.status === 'pending') await settleInvoice(tx, current.tenantId, current.invoiceId, current.id, 'billing');
  else if (['failed', 'expired', 'refunded'].includes(remote.status) && current.status !== remote.status) await tx.billingPayment.update({ where: { id: current.id }, data: { status: remote.status } });
 });
 await finish(ev.id, 'processed', null, payment.tenantId);
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

// Invoice delivery by email through Resend (RESEND_API_KEY, RESEND_FROM). Without a key, deliveries stay queued.
// Idempotency-Key = delivery id, so a retry after a timeout never sends twice.
const SUBJECT: Record<string, string> = { 'pt-BR': 'Fatura {n} — AtlasHub', 'pt-PT': 'Fatura {n} — AtlasHub', en: 'Invoice {n} — AtlasHub', es: 'Factura {n} — AtlasHub', fr: 'Facture {n} — AtlasHub' };
export async function deliverInvoices() {
 if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return 0;
 const queued = await scoped(db, { scope: 'platform', userId: 'delivery' }, tx => tx.billingDelivery.findMany({ where: { status: 'queued', channel: 'email', attempts: { lt: 5 } }, take: 20, orderBy: { createdAt: 'asc' } }));
 for (const d of queued) {
  const doc = await scoped(db, { tenantId: d.tenantId }, async tx => {
   const v = await tx.billingInvoice.findFirstOrThrow({ where: { tenantId: d.tenantId, id: d.invoiceId } });
   const [issuer, account, lines] = await Promise.all([tx.billingIssuer.findUniqueOrThrow({ where: { id: v.issuerId } }), tx.billingAccount.findUniqueOrThrow({ where: { id: v.accountId } }), tx.billingInvoiceLine.findMany({ where: { tenantId: d.tenantId, invoiceId: v.id } })]);
   return { number: v.number ?? '', locale: asLocale(v.locale), html: renderInvoiceHtml({ ...v, locale: asLocale(v.locale), issuer, account, lines }) };
  });
  let status = 'sent', error: string | null = null;
  // Staging guard: RESEND_RECIPIENT_DOMAINS limits real sends (e.g. "resend.dev,atlashub.si") so synthetic
  // addresses never hit the provider and the sending domain keeps its reputation.
  const allowed = (process.env.RESEND_RECIPIENT_DOMAINS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(d.recipient.split('@')[1]?.toLowerCase() ?? '')) {
   await scoped(db, { tenantId: d.tenantId }, tx => tx.billingDelivery.update({ where: { id: d.id }, data: { status: 'skipped', lastError: 'recipient_not_allowed', attempts: { increment: 1 } } }));
   continue;
  }
  try {
   const r = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': d.id }, body: JSON.stringify({ from: process.env.RESEND_FROM, to: [d.recipient], subject: SUBJECT[doc.locale].replace('{n}', doc.number), html: doc.html, ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {}) }) });
   if (!r.ok) { status = r.status >= 500 || r.status === 429 ? 'queued' : 'failed'; error = `resend_${r.status}`; }
  } catch { status = 'queued'; error = 'resend_unreachable'; }
  await scoped(db, { tenantId: d.tenantId }, tx => tx.billingDelivery.update({ where: { id: d.id }, data: { status, lastError: error, attempts: { increment: 1 }, ...(status === 'sent' ? { sentAt: new Date() } : {}) } }));
 }
 return queued.length;
}
