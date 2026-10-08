import { createHmac, timingSafeEqual } from 'node:crypto';

// Payment providers. Each adapter: create a checkout for an invoice, verify an inbound webhook
// signature, and re-read the payment from the provider. A payment is only marked paid from the
// re-read (fetch), never from the webhook payload alone.
//   Brazil (BRL): Mercado Pago (PIX) — MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET
//   International (EUR/USD): Stripe Checkout — STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   Staging: sandbox — SANDBOX_PAYMENTS_SECRET (signed simulated webhooks; the verified webhook is the ledger)
//   Stone and PicPay are reserved in the data model; adapters are added once credentials exist.
export type Provider = 'sandbox' | 'mercadopago' | 'stripe' | 'stone' | 'picpay';
export interface CheckoutRequest { paymentId: string; invoiceNumber: string; amountMinor: number; currency: string; email: string; locale: string }
export interface Checkout { providerRef: string; method: 'pix' | 'card' | 'checkout'; checkout: Record<string, unknown> }
export interface VerifiedEvent { eventId: string; eventType: string; providerRef: string; facts: Record<string, unknown> }
export interface ProviderPayment { status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'expired'; amountMinor: number; currency: string; reference?: string }
export interface PaymentAdapter {
 provider: Provider;
 configured(): boolean;
 createCheckout(r: CheckoutRequest): Promise<Checkout>;
 verifyWebhook(raw: Buffer, headers: Record<string, string | string[] | undefined>, body: any): VerifiedEvent | null;
 fetchPayment(providerRef: string, facts: Record<string, unknown>): Promise<ProviderPayment>;
}

const header = (h: Record<string, string | string[] | undefined>, k: string) => { const v = h[k.toLowerCase()]; return Array.isArray(v) ? v[0] : v; };
const parts = (v: string | undefined) => Object.fromEntries((v ?? '').split(',').map(p => p.trim().split('=') as [string, string]).filter(p => p.length === 2));
export function safeEqualHex(a: string, b: string) { return /^[a-f0-9]+$/.test(a) && a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
const TOLERANCE_S = 300;
const fresh = (unixSeconds: number) => Number.isFinite(unixSeconds) && Math.abs(Date.now() / 1000 - unixSeconds) <= TOLERANCE_S;

// Stripe: Stripe-Signature "t=<unix>,v1=<hex>" = HMAC-SHA256(secret, `${t}.${rawBody}`).
export function verifyStripeSignature(raw: Buffer, signature: string | undefined, secret: string) {
 const p = parts(signature); const t = Number(p.t);
 if (!secret || !p.v1 || !fresh(t)) return false;
 return safeEqualHex(p.v1, createHmac('sha256', secret).update(`${p.t}.${raw.toString('utf8')}`).digest('hex'));
}
// Mercado Pago: x-signature "ts=<unix>,v1=<hex>" = HMAC-SHA256(secret, `id:${data.id};request-id:${x-request-id};ts:${ts};`).
export function verifyMercadoPagoSignature(dataId: string, requestId: string | undefined, signature: string | undefined, secret: string) {
 const p = parts(signature); const ts = Number(p.ts);
 if (!secret || !p.v1 || !dataId || !fresh(ts > 1e12 ? ts / 1000 : ts)) return false;
 const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
 const manifest = `id:${id};${requestId ? `request-id:${requestId};` : ''}ts:${p.ts};`;
 return safeEqualHex(p.v1, createHmac('sha256', secret).update(manifest).digest('hex'));
}

const sandbox: PaymentAdapter = {
 provider: 'sandbox',
 configured: () => (process.env.SANDBOX_PAYMENTS_SECRET?.length ?? 0) >= 32,
 async createCheckout(r) {
  const providerRef = `sbx_${r.paymentId}`;
  return { providerRef, method: r.currency === 'BRL' ? 'pix' : 'checkout', checkout: r.currency === 'BRL' ? { qr_code: `SANDBOX-PIX-${providerRef}`, expires_at: new Date(Date.now() + 3600e3).toISOString() } : { url: `https://sandbox.invalid/checkout/${providerRef}` } };
 },
 // Simulated provider: X-Sandbox-Signature "t=<unix>,v1=<hex>" over `${t}.${rawBody}` with SANDBOX_PAYMENTS_SECRET.
 verifyWebhook(raw, headers, body) {
  if (!verifyStripeSignature(raw, header(headers, 'x-sandbox-signature'), process.env.SANDBOX_PAYMENTS_SECRET ?? '')) return null;
  if (typeof body?.id !== 'string' || typeof body?.payment_ref !== 'string') return null;
  return { eventId: body.id, eventType: String(body.type ?? 'payment.updated'), providerRef: body.payment_ref, facts: { status: body.status, amount_minor: body.amount_minor, currency: body.currency } };
 },
 async fetchPayment(_ref, f) { return { status: (['succeeded', 'failed', 'expired', 'refunded'].includes(String(f.status)) ? f.status : 'pending') as ProviderPayment['status'], amountMinor: Number(f.amount_minor), currency: String(f.currency) }; },
};

const mercadopago: PaymentAdapter = {
 provider: 'mercadopago',
 configured: () => !!process.env.MP_ACCESS_TOKEN && !!process.env.MP_WEBHOOK_SECRET,
 async createCheckout(r) {
  if (r.currency !== 'BRL') throw new Error('provider_currency');
  const res = await fetch('https://api.mercadopago.com/v1/payments', {
   method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error',
   headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': r.paymentId },
   body: JSON.stringify({ transaction_amount: r.amountMinor / 100, description: `Fatura ${r.invoiceNumber}`, payment_method_id: 'pix', payer: { email: r.email }, external_reference: r.paymentId, ...(process.env.PUBLIC_API_URL ? { notification_url: `${process.env.PUBLIC_API_URL}/v1/webhooks/payments/mercadopago` } : {}) }),
  });
  if (!res.ok) throw new Error('provider_unavailable');
  const p = await res.json() as any; const tx = p.point_of_interaction?.transaction_data ?? {};
  return { providerRef: String(p.id), method: 'pix', checkout: { qr_code: tx.qr_code, qr_code_base64: tx.qr_code_base64, ticket_url: tx.ticket_url, expires_at: p.date_of_expiration } };
 },
 verifyWebhook(_raw, headers, body) {
  const id = String(body?.data?.id ?? '');
  if (body?.type !== 'payment' || !verifyMercadoPagoSignature(id, header(headers, 'x-request-id'), header(headers, 'x-signature'), process.env.MP_WEBHOOK_SECRET ?? '')) return null;
  return { eventId: header(headers, 'x-request-id') ?? `${id}:${parts(header(headers, 'x-signature')).ts}`, eventType: `payment.${body.action ?? 'updated'}`, providerRef: id, facts: {} };
 },
 async fetchPayment(ref) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!res.ok) throw new Error('provider_unavailable');
  const p = await res.json() as any;
  const status = ({ approved: 'succeeded', rejected: 'failed', cancelled: 'expired', refunded: 'refunded', charged_back: 'refunded' } as Record<string, ProviderPayment['status']>)[p.status] ?? 'pending';
  return { status, amountMinor: Math.round(Number(p.transaction_amount) * 100), currency: String(p.currency_id), reference: p.external_reference };
 },
};

const stripe: PaymentAdapter = {
 provider: 'stripe',
 configured: () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
 async createCheckout(r) {
  const base = process.env.PUBLIC_APP_URL ?? 'https://app.atlashub.si';
  const form = new URLSearchParams({ mode: 'payment', client_reference_id: r.paymentId, customer_email: r.email, locale: r.locale.slice(0, 2), 'metadata[payment_id]': r.paymentId, 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': r.currency.toLowerCase(), 'line_items[0][price_data][unit_amount]': String(r.amountMinor), 'line_items[0][price_data][product_data][name]': `Invoice ${r.invoiceNumber}`, success_url: `${base}/portal?paid=${r.paymentId}`, cancel_url: `${base}/portal?cancelled=${r.paymentId}` });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': r.paymentId }, body: form });
  if (!res.ok) throw new Error('provider_unavailable');
  const s = await res.json() as any;
  return { providerRef: String(s.id), method: 'checkout', checkout: { url: s.url, expires_at: s.expires_at ? new Date(s.expires_at * 1000).toISOString() : undefined } };
 },
 verifyWebhook(raw, headers, body) {
  if (!verifyStripeSignature(raw, header(headers, 'stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET ?? '')) return null;
  const obj = body?.data?.object;
  if (typeof body?.id !== 'string' || obj?.object !== 'checkout.session') return null;
  return { eventId: body.id, eventType: String(body.type), providerRef: String(obj.id), facts: {} };
 },
 async fetchPayment(ref) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!res.ok) throw new Error('provider_unavailable');
  const s = await res.json() as any;
  return { status: s.payment_status === 'paid' ? 'succeeded' : s.status === 'expired' ? 'expired' : 'pending', amountMinor: Number(s.amount_total), currency: String(s.currency).toUpperCase(), reference: s.client_reference_id };
 },
};

export const ADAPTERS: Record<string, PaymentAdapter> = { sandbox, mercadopago, stripe };

// BRL → Mercado Pago (PIX); EUR/USD → Stripe. PAYMENTS_MODE=sandbox forces the simulated provider (staging).
export function chooseProvider(currency: string): PaymentAdapter {
 if (process.env.PAYMENTS_MODE === 'sandbox') return sandbox;
 const preferred = currency === 'BRL' ? mercadopago : stripe;
 if (!preferred.configured()) throw new Error('provider_not_configured');
 return preferred;
}
