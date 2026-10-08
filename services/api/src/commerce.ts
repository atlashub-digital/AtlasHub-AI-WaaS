import { Controller, Get, Post, Param, Query, Req, Res, Body, HttpCode, BadRequestException, NotFoundException, ForbiddenException, UnauthorizedException, GoneException, ConflictException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withDb, billingQueue } from './context.js';
import { identity } from './auth.js';
import { asLocale, pick, CONSENT_TEXT, CONSENT_VERSION, DISCLAIMER, COMMERCE_LOCALES, CURRENCIES } from '../../../packages/commerce/i18n.js';
import { simulationInput, simulate, leadInput, trialInput, normEmail, normPhone, suppressionHash, tokenHash, fitScore, STAGES, STAGE_MOVES, toNumber } from '../../../packages/commerce/funnel.js';
import { ADAPTERS, chooseProvider } from '../../../packages/commerce/payments.js';
import { renderInvoiceHtml, invoiceNumber } from '../../../packages/commerce/invoice.js';

type Tx = Prisma.TransactionClient;
const HOUSE = process.env.HOUSE_TENANT_ID ?? 'atlashub';
const parse = <T>(schema: z.ZodType<T>, data: unknown): T => { const r = schema.safeParse(data); if (!r.success) throw new BadRequestException('Invalid request'); return r.data; };
const issuerFor = (country: string | undefined, currency: string) => (country === 'BR' || currency === 'BRL') ? 'atlashub-br' : 'atlashub-uk';
async function operator(req: any) { const who = await identity(req, HOUSE, true); if (!who.role.startsWith('atlas_')) throw new ForbiddenException(); return who; }
async function activity(tx: Tx, leadId: string, kind: string, note: string, actor: string) { await tx.crmActivity.create({ data: { id: randomUUID(), tenantId: HOUSE, leadId, kind, note, actor } }); }

// Contact + company + consent + lead in the house tenant, deduplicated by normalised email (then phone).
async function upsertLead(tx: Tx, i: z.infer<typeof leadInput>, purpose: 'contact_sales' | 'trial', ip: string) {
 const emailNorm = normEmail(i.email); const phone = normPhone(i.phone, i.locale);
 const suppressed = await tx.crmSuppression.findFirst({ where: { tenantId: HOUSE, OR: [{ kind: 'email', valueHash: suppressionHash('email', emailNorm) }, ...(phone ? [{ kind: 'phone', valueHash: suppressionHash('phone', phone) }] : [])] } });
 if (suppressed) return null;
 let companyId: string | null = null;
 if (i.company) {
  const domain = i.companyDomain?.toLowerCase().replace(/^www\./, '') || emailNorm.split('@')[1];
  const existing = await tx.crmCompany.findFirst({ where: { tenantId: HOUSE, domain } });
  companyId = existing?.id ?? (await tx.crmCompany.create({ data: { id: randomUUID(), tenantId: HOUSE, name: i.company, domain, country: i.country, sizeBand: i.sizeBand } })).id;
 }
 const contact = await tx.crmContact.findFirst({ where: { tenantId: HOUSE, emailNorm } }) ?? await tx.crmContact.create({ data: { id: randomUUID(), tenantId: HOUSE, companyId, fullName: i.fullName, emailNorm, phoneE164: phone, preferredLocale: i.locale } });
 await tx.crmConsent.create({ data: { id: randomUUID(), tenantId: HOUSE, contactId: contact.id, purpose, lawfulBasis: 'consent', source: i.source, textVersion: i.consentTextVersion, locale: i.locale, evidence: { text: CONSENT_TEXT[purpose][i.locale], ipHash: createHash('sha256').update(ip).digest('hex').slice(0, 16), utm: i.utm } } });
 const score = fitScore(i);
 const open = await tx.crmLead.findFirst({ where: { tenantId: HOUSE, contactId: contact.id, stage: { notIn: ['won', 'lost'] } } });
 const fit = { sizeBand: i.sizeBand, simulation: i.simulation ?? null } as Prisma.InputJsonValue;
 const lead = open
  ? await tx.crmLead.update({ where: { id: open.id }, data: { score: Math.max(open.score, score), fit, interestRoles: [...new Set([...open.interestRoles, ...i.interestRoles])], companyId: open.companyId ?? companyId } })
  : await tx.crmLead.create({ data: { id: randomUUID(), tenantId: HOUSE, contactId: contact.id, companyId, source: i.source, stage: i.simulation ? 'simulation' : 'new', score, fit, interestRoles: i.interestRoles, locale: i.locale, utm: i.utm, conciergeSessionId: i.conciergeSessionId } });
 if (i.conciergeSessionId) await tx.conciergeSession.updateMany({ where: { tenantId: HOUSE, id: i.conciergeSessionId }, data: { leadId: lead.id } });
 await activity(tx, lead.id, open ? 'lead.updated' : 'lead.created', `source=${i.source} score=${score}`, i.source === 'clara' ? 'agent:clara' : 'visitor');
 return { lead, contact };
}

@Controller()
export class Commerce {
 // ---------- Public funnel (site, simulators, Clara) ----------
 @Get('v1/public/catalog') async catalog(@Query('locale') l?: string, @Query('currency') c?: string) {
  const locale = asLocale(l); const currency = (CURRENCIES as readonly string[]).includes(String(c)) ? String(c) : 'BRL';
  return withDb({}, async tx => {
   const templates = await tx.catalogMissionTemplate.findMany({ where: { status: 'active' }, orderBy: { id: 'asc' } });
   const ti18n = await tx.catalogMissionTemplateI18n.findMany({ where: { templateId: { in: templates.map(t => t.id) } } });
   const products = await tx.catalogProduct.findMany({ where: { status: 'active' } });
   const pi18n = await tx.catalogProductI18n.findMany({ where: { productId: { in: products.map(p => p.id) } } });
   const prices = await tx.catalogPrice.findMany({ where: { status: 'active', currency, productId: { in: products.map(p => p.id) } } });
   return { locale, currency, locales: COMMERCE_LOCALES, templates: templates.map(t => { const tr = pick(ti18n.filter(x => x.templateId === t.id), locale); return { id: t.id, roleId: t.roleId, kind: t.kind, durationDays: t.durationDays, capacity: t.capacity, optionalAddons: t.optionalAddons, servedLocale: tr?.locale, name: tr?.name, objective: tr?.objective, scopeIn: tr?.scopeIn, scopeOut: tr?.scopeOut, trialDays: [3, 7] }; }),
    products: products.map(p => { const tr = pick(pi18n.filter(x => x.productId === p.id), locale); return { id: p.id, kind: p.kind, roleId: p.roleId, templateId: p.templateId, name: tr?.name, description: tr?.description, prices: prices.filter(x => x.productId === p.id).map(x => ({ id: x.id, pricingModel: x.pricingModel, interval: x.interval, amountMinor: toNumber(x.amountMinor), includedQuantity: x.includedQuantity, overageMinor: toNumber(x.overageMinor), usageMetric: x.usageMetric, trialDays: x.trialDays })) }; }) };
  });
 }
 @Post('v1/public/simulate') @HttpCode(200) async simulate(@Body() body: unknown) {
  const i = parse(simulationInput, body); const out = simulate(i);
  // Price is shown only when an approved (active) price exists for this template and currency.
  const price = i.templateId ? await withDb({}, async tx => { const product = await tx.catalogProduct.findFirst({ where: { templateId: i.templateId, kind: 'mission', status: 'active' } }); return product ? tx.catalogPrice.findFirst({ where: { productId: product.id, currency: i.currency, status: 'active', interval: 'month' } }) : null; }) : null;
  return { ...out, currency: i.currency, monthlyPriceMinor: toNumber(price?.amountMinor), priceId: price?.id ?? null, disclaimer: DISCLAIMER[i.locale] };
 }
 @Get('v1/public/consent-text') consentText(@Query('purpose') purpose = 'contact_sales', @Query('locale') l?: string) {
  const p = purpose === 'trial' ? 'trial' : 'contact_sales'; const locale = asLocale(l);
  return { purpose: p, locale, version: CONSENT_VERSION, text: CONSENT_TEXT[p][locale] };
 }
 @Post('v1/public/leads') @HttpCode(202) async lead(@Req() req: any, @Body() body: unknown) {
  const i = parse(leadInput, body);
  if (i.website || i.consentTextVersion !== CONSENT_VERSION) return { status: 'received' };
  await withDb({ tenantId: HOUSE, scope: 'public_intake' }, tx => upsertLead(tx, i, 'contact_sales', req.socket?.remoteAddress ?? ''));
  return { status: 'received' };
 }
 @Post('v1/public/trials') @HttpCode(202) async trial(@Req() req: any, @Body() body: unknown) {
  const i = parse(trialInput, body);
  if (i.website || i.consentTextVersion !== CONSENT_VERSION) return { status: 'received' };
  return withDb({ tenantId: HOUSE, scope: 'public_intake' }, async tx => {
   const template = await tx.catalogMissionTemplate.findFirst({ where: { id: i.templateId, status: 'active' } });
   if (!template) throw new BadRequestException('Unknown template');
   const r = await upsertLead(tx, i, 'trial', req.socket?.remoteAddress ?? '');
   if (!r) return { status: 'received' };
   const open = await tx.commerceTrial.findFirst({ where: { tenantId: HOUSE, leadId: r.lead.id, status: { in: ['requested', 'approved', 'active'] } } });
   const trial = open ?? await tx.commerceTrial.create({ data: { id: randomUUID(), tenantId: HOUSE, leadId: r.lead.id, templateId: template.id, days: i.days } });
   if (!open) { await tx.crmLead.update({ where: { id: r.lead.id }, data: { stage: 'trial_requested' } }); await activity(tx, r.lead.id, 'trial.requested', `${template.id} ${i.days}d`, 'visitor'); }
   // Activation is never automatic: a person reviews scope, data and integrations first.
   return { status: 'received', trial: { reference: trial.id, days: trial.days, state: trial.status } };
  });
 }
 @Post('v1/public/concierge/sessions') @HttpCode(201) async conciergeSession(@Req() req: any, @Body() body: unknown) {
  // Called by the Clara agent (Hermes) with the service key; records only metadata and qualification.
  if (!process.env.CONCIERGE_SERVICE_KEY || req.headers['x-atlas-service-key'] !== process.env.CONCIERGE_SERVICE_KEY) throw new UnauthorizedException();
  const i = parse(z.object({ channel: z.enum(['webchat', 'whatsapp', 'email']), locale: z.enum(COMMERCE_LOCALES), aiDisclosed: z.literal(true), qualification: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).refine(q => Object.keys(q).length <= 20).default({}) }).strict(), body);
  return withDb({ tenantId: HOUSE }, tx => tx.conciergeSession.create({ data: { id: randomUUID(), tenantId: HOUSE, agent: 'hermes:clara', ...i } }));
 }
 @Post('v1/public/quotes/accept') @HttpCode(201) async accept(@Body() body: unknown) {
  const i = parse(z.object({ token: z.string().min(32).max(128), acceptedBy: z.string().trim().min(2).max(120), billing: z.object({ legalName: z.string().trim().min(2).max(160), taxId: z.string().max(40).optional(), country: z.string().length(2), email: z.string().email().max(200), address: z.object({ line1: z.string().max(160), city: z.string().max(80), postal_code: z.string().max(20) }).partial().strict().default({}) }).strict() }).strict(), body);
  const quote = await withDb({ scope: 'quote_accept' }, tx => tx.commerceQuote.findUnique({ where: { acceptTokenHash: tokenHash(i.token) } }));
  if (!quote) throw new NotFoundException();
  if (quote.status !== 'sent') throw new ConflictException('Quote is not open');
  if (quote.validUntil.getTime() < Date.now()) throw new GoneException('Quote expired');
  // Accepting creates the customer tenant and its books; a platform-scope transaction, fully audited.
  const result = await withDb({ scope: 'platform', userId: 'quote-accept' }, async tx => {
   const lines = await tx.commerceQuoteLine.findMany({ where: { tenantId: HOUSE, quoteId: quote.id } });
   const prices = await tx.catalogPrice.findMany({ where: { id: { in: lines.map(l => l.priceId) } } });
   const products = await tx.catalogProduct.findMany({ where: { id: { in: prices.map(p => p.productId) } } });
   const lead = await tx.crmLead.findUniqueOrThrow({ where: { id: quote.leadId } });
   const tenantId = randomUUID();
   await tx.tenant.create({ data: { id: tenantId, slug: `c-${tenantId.slice(0, 8)}`, name: i.billing.legalName } });
   const account = await tx.billingAccount.create({ data: { id: randomUUID(), tenantId, issuerId: quote.issuerId, legalName: i.billing.legalName, taxId: i.billing.taxId, country: i.billing.country, email: i.billing.email, address: i.billing.address, currency: quote.currency, locale: quote.locale } });
   const order = await tx.commerceOrder.create({ data: { id: randomUUID(), tenantId, quoteId: quote.id, currency: quote.currency, totalMinor: quote.totalMinor } });
   for (const l of lines) { const p = prices.find(x => x.id === l.priceId)!; if (p.interval !== 'one_time') await tx.commerceSubscription.create({ data: { id: randomUUID(), tenantId, orderId: order.id, priceId: p.id, quantity: l.quantity } }); }
   const invoice = await issueInvoice(tx, { tenantId, accountId: account.id, issuerId: quote.issuerId, orderId: order.id, currency: quote.currency, locale: quote.locale, lines: lines.map(l => ({ priceId: l.priceId, description: l.description, quantity: l.quantity, unitMinor: l.unitMinor, amountMinor: l.amountMinor })) });
   await tx.billingDelivery.create({ data: { id: randomUUID(), tenantId, invoiceId: invoice.id, channel: 'email', recipient: i.billing.email } });
   await tx.commerceQuote.update({ where: { id: quote.id }, data: { status: 'accepted', acceptedAt: new Date(), acceptedBy: i.acceptedBy, customerTenantId: tenantId, acceptTokenHash: null } });
   await tx.crmLead.update({ where: { id: lead.id }, data: { stage: 'won' } });
   await activity(tx, lead.id, 'quote.accepted', `quote=${quote.id} order=${order.id} products=${products.map(p => p.id).join(',')}`, 'customer');
   await tx.auditEvent.create({ data: { tenantId, actorId: 'quote-accept', action: 'tenant.create.quote', objectId: quote.id } });
   return { tenantId, invoice, account };
  });
  const payment = await startPayment(result.tenantId, result.invoice.id);
  return { tenant: result.tenantId, invoice: { id: result.invoice.id, number: result.invoice.number, totalMinor: toNumber(result.invoice.totalMinor), currency: result.invoice.currency }, payment };
 }

 // ---------- AtlasHub operations (house tenant, atlas_* roles) ----------
 @Get('v1/ops/crm/leads') async leads(@Req() req: any, @Query('stage') stage?: string) {
  const who = await operator(req);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const leads = await tx.crmLead.findMany({ where: { tenantId: HOUSE, ...(stage && (STAGES as readonly string[]).includes(stage) ? { stage } : {}) }, orderBy: { updatedAt: 'desc' }, take: 200 });
   const contacts = await tx.crmContact.findMany({ where: { tenantId: HOUSE, id: { in: leads.map(l => l.contactId) } } });
   return leads.map(l => ({ ...l, contact: contacts.find(c => c.id === l.contactId) }));
  });
 }
 @Post('v1/ops/crm/leads/:id/stage') async stage(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
  const who = await operator(req); const i = parse(z.object({ stage: z.enum(STAGES), reason: z.string().max(200).optional() }).strict(), body);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const lead = await tx.crmLead.findFirst({ where: { tenantId: HOUSE, id } }); if (!lead) throw new NotFoundException();
   if (!STAGE_MOVES[lead.stage]?.includes(i.stage)) throw new BadRequestException('Invalid stage move');
   const updated = await tx.crmLead.update({ where: { id }, data: { stage: i.stage, ...(i.stage === 'lost' ? { lostReason: i.reason ?? 'unspecified' } : {}) } });
   await activity(tx, id, 'stage.moved', `${lead.stage}->${i.stage}`, who.sub); return updated;
  });
 }
 @Post('v1/ops/crm/leads/:id/suppress') @HttpCode(200) async suppress(@Req() req: any, @Param('id') id: string) {
  const who = await operator(req);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const lead = await tx.crmLead.findFirst({ where: { tenantId: HOUSE, id } }); if (!lead) throw new NotFoundException();
   const c = await tx.crmContact.findUniqueOrThrow({ where: { id: lead.contactId } });
   for (const [kind, v] of [['email', c.emailNorm], ['phone', c.phoneE164]] as const) if (v) await tx.crmSuppression.upsert({ where: { tenantId_kind_valueHash: { tenantId: HOUSE, kind, valueHash: suppressionHash(kind, v) } }, create: { id: randomUUID(), tenantId: HOUSE, kind, valueHash: suppressionHash(kind, v), reason: 'opt_out' }, update: {} });
   await tx.crmConsent.updateMany({ where: { tenantId: HOUSE, contactId: c.id, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
   await tx.crmLead.update({ where: { id }, data: { stage: 'lost', lostReason: 'opt_out' } });
   await activity(tx, id, 'contact.suppressed', 'opt-out recorded; consents withdrawn', who.sub); return { suppressed: true };
  });
 }
 @Post('v1/ops/crm/imports') @HttpCode(201) async importValidate(@Req() req: any, @Body() body: unknown) {
  // Lead injection: rows are validated, normalised, deduplicated and checked against suppressions; nothing is
  // contacted from here. A declared lawful basis is mandatory (no purchased lists or scraped personal data).
  const who = await operator(req);
  const i = parse(z.object({ source: z.enum(['event', 'partner', 'referral', 'api']), lawfulBasis: z.enum(['consent', 'legitimate_interest', 'contract']), basisNote: z.string().min(10).max(500), rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000) }).strict(), body);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const batchId = randomUUID(); const seen = new Set<string>(); const out: { rowNo: number; normalized: any; errors: string[]; outcome: string }[] = [];
   for (const [n, raw] of i.rows.entries()) {
    const errors: string[] = []; const loc = asLocale(raw.locale);
    const email = typeof raw.email === 'string' && z.string().email().safeParse(raw.email.trim()).success ? normEmail(raw.email) : null;
    const phone = normPhone(typeof raw.phone === 'string' ? raw.phone : undefined, loc);
    const fullName = typeof raw.fullName === 'string' ? raw.fullName.trim().slice(0, 120) : '';
    if (!fullName) errors.push('name_missing'); if (!email && !phone) errors.push('contact_missing');
    const normalized = { fullName, email, phone, company: typeof raw.company === 'string' ? raw.company.slice(0, 160) : null, country: typeof raw.country === 'string' ? raw.country.slice(0, 2).toUpperCase() : null, locale: loc };
    let outcome = errors.length ? 'rejected' : 'valid';
    if (outcome === 'valid') {
     const key = email ?? phone!;
     if (seen.has(key) || await tx.crmContact.findFirst({ where: { tenantId: HOUSE, OR: [...(email ? [{ emailNorm: email }] : []), ...(phone ? [{ phoneE164: phone }] : [])] } })) outcome = 'duplicate';
     else if (await tx.crmSuppression.findFirst({ where: { tenantId: HOUSE, OR: [...(email ? [{ kind: 'email', valueHash: suppressionHash('email', email) }] : []), ...(phone ? [{ kind: 'phone', valueHash: suppressionHash('phone', phone) }] : [])] } })) outcome = 'suppressed';
     seen.add(key);
    }
    out.push({ rowNo: n + 1, normalized, errors, outcome });
   }
   const count = (o: string) => out.filter(r => r.outcome === o).length;
   const batch = await tx.crmImportBatch.create({ data: { id: batchId, tenantId: HOUSE, source: i.source, lawfulBasis: i.lawfulBasis, basisNote: i.basisNote, rowsTotal: out.length, rowsValid: count('valid'), rowsDuplicate: count('duplicate'), rowsRejected: count('rejected'), rowsSuppressed: count('suppressed'), createdBy: who.sub } });
   await tx.crmImportRow.createMany({ data: out.map(r => ({ id: randomUUID(), tenantId: HOUSE, batchId, ...r })) });
   return batch;
  });
 }
 @Post('v1/ops/crm/imports/:id/commit') @HttpCode(200) async importCommit(@Req() req: any, @Param('id') id: string) {
  const who = await operator(req);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const batch = await tx.crmImportBatch.findFirst({ where: { tenantId: HOUSE, id } }); if (!batch) throw new NotFoundException();
   if (batch.status !== 'validated') throw new ConflictException('Batch already processed');
   const rows = await tx.crmImportRow.findMany({ where: { tenantId: HOUSE, batchId: id, outcome: 'valid' }, orderBy: { rowNo: 'asc' } });
   for (const r of rows) {
    const n = r.normalized as { fullName: string; email: string | null; phone: string | null; locale: string };
    const contact = await tx.crmContact.create({ data: { id: randomUUID(), tenantId: HOUSE, fullName: n.fullName, emailNorm: n.email, phoneE164: n.phone, preferredLocale: n.locale } });
    await tx.crmConsent.create({ data: { id: randomUUID(), tenantId: HOUSE, contactId: contact.id, purpose: 'contact_sales', lawfulBasis: batch.lawfulBasis, source: `import:${batch.source}`, textVersion: 'import', locale: n.locale, evidence: { batchId: id, basisNote: batch.basisNote } } });
    const lead = await tx.crmLead.create({ data: { id: randomUUID(), tenantId: HOUSE, contactId: contact.id, source: 'import', locale: n.locale, interestRoles: [] } });
    await tx.crmImportRow.update({ where: { id: r.id }, data: { outcome: 'imported', leadId: lead.id } });
    await activity(tx, lead.id, 'lead.imported', `batch=${id}`, who.sub);
   }
   await tx.crmImportBatch.update({ where: { id }, data: { status: 'imported' } });
   return { imported: rows.length };
  });
 }
 @Post('v1/ops/trials/:id/approve') @HttpCode(200) async approveTrial(@Req() req: any, @Param('id') id: string) {
  const who = await operator(req);
  // Approval creates the customer tenant, a time-boxed entitlement and a mission in provisioning. The digital
  // employee itself is provisioned by an operator into 'sandbox' (POST /v1/deployments); it never goes live alone.
  return withDb({ scope: 'platform', userId: who.sub }, async tx => {
   const trial = await tx.commerceTrial.findFirst({ where: { tenantId: HOUSE, id } }); if (!trial) throw new NotFoundException();
   if (trial.status !== 'requested') throw new ConflictException('Trial is not pending');
   const lead = await tx.crmLead.findUniqueOrThrow({ where: { id: trial.leadId } }); const contact = await tx.crmContact.findUniqueOrThrow({ where: { id: lead.contactId } });
   const company = lead.companyId ? await tx.crmCompany.findUnique({ where: { id: lead.companyId } }) : null;
   const template = await tx.catalogMissionTemplate.findUniqueOrThrow({ where: { id: trial.templateId } });
   const tenantId = randomUUID(); const now = new Date(); const endsAt = new Date(now.getTime() + trial.days * 864e5);
   await tx.tenant.create({ data: { id: tenantId, slug: `t-${tenantId.slice(0, 8)}`, name: company?.name ?? contact.fullName } });
   await tx.commerceEntitlement.create({ data: { id: randomUUID(), tenantId, key: `mission.${template.id}`, source: 'trial', sourceId: trial.id, validFrom: now, validUntil: endsAt } });
   await tx.commerceMission.create({ data: { id: randomUUID(), tenantId, templateId: template.id, kind: template.kind, capacity: template.capacity as Prisma.InputJsonValue, source: 'trial', sourceId: trial.id, startsAt: now, endsAt } });
   await tx.commerceTrial.update({ where: { id }, data: { status: 'active', approvedAt: now, endsAt, customerTenantId: tenantId } });
   await tx.crmLead.update({ where: { id: lead.id }, data: { stage: 'trial_active' } });
   await activity(tx, lead.id, 'trial.approved', `${template.id} ${trial.days}d tenant=${tenantId}`, who.sub);
   await tx.auditEvent.create({ data: { tenantId, actorId: who.sub, action: 'tenant.create.trial', objectId: trial.id } });
   return { trial: id, tenant: tenantId, endsAt };
  });
 }
 @Post('v1/ops/trials/:id/decline') @HttpCode(200) async declineTrial(@Req() req: any, @Param('id') id: string) {
  const who = await operator(req);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const changed = await tx.commerceTrial.updateMany({ where: { tenantId: HOUSE, id, status: 'requested' }, data: { status: 'declined' } });
   if (!changed.count) throw new ConflictException('Trial is not pending'); return { declined: true };
  });
 }
 @Post('v1/ops/quotes') @HttpCode(201) async quote(@Req() req: any, @Body() body: unknown) {
  const who = await operator(req);
  const i = parse(z.object({ leadId: z.string(), currency: z.enum(CURRENCIES), locale: z.enum(COMMERCE_LOCALES), country: z.string().length(2).optional(), validDays: z.number().int().min(1).max(60).default(14), lines: z.array(z.object({ priceId: z.string(), quantity: z.number().int().min(1).max(1000), unitMinor: z.number().int().min(0).optional() }).strict()).min(1).max(20) }).strict(), body);
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const lead = await tx.crmLead.findFirst({ where: { tenantId: HOUSE, id: i.leadId } }); if (!lead) throw new NotFoundException();
   const prices = await tx.catalogPrice.findMany({ where: { id: { in: i.lines.map(l => l.priceId) } } });
   const i18n = await tx.catalogProductI18n.findMany({ where: { productId: { in: prices.map(p => p.productId) } } });
   const lines = i.lines.map(l => {
    const p = prices.find(x => x.id === l.priceId);
    if (!p || p.status !== 'active' || p.currency !== i.currency) throw new BadRequestException('Price not available');
    const unit = p.pricingModel === 'custom' ? l.unitMinor : toNumber(p.amountMinor);
    if (unit === undefined || unit === null) throw new BadRequestException('Price requires an amount');
    return { priceId: p.id, quantity: l.quantity, unitMinor: BigInt(unit), amountMinor: BigInt(unit) * BigInt(l.quantity), description: pick(i18n.filter(x => x.productId === p.productId), i.locale)?.name ?? p.productId };
   });
   const quote = await tx.commerceQuote.create({ data: { id: randomUUID(), tenantId: HOUSE, leadId: lead.id, issuerId: issuerFor(i.country, i.currency), currency: i.currency, locale: i.locale, totalMinor: lines.reduce((a, l) => a + l.amountMinor, 0n), validUntil: new Date(Date.now() + i.validDays * 864e5), termsVersion: 'terms-v1-draft' } });
   await tx.commerceQuoteLine.createMany({ data: lines.map(l => ({ id: randomUUID(), tenantId: HOUSE, quoteId: quote.id, ...l })) });
   await activity(tx, lead.id, 'quote.created', `quote=${quote.id}`, who.sub);
   return { ...quote, totalMinor: toNumber(quote.totalMinor) };
  });
 }
 @Post('v1/ops/quotes/:id/send') @HttpCode(200) async sendQuote(@Req() req: any, @Param('id') id: string) {
  const who = await operator(req); const token = randomBytes(32).toString('base64url');
  return withDb({ tenantId: HOUSE, userId: who.sub }, async tx => {
   const changed = await tx.commerceQuote.updateMany({ where: { tenantId: HOUSE, id, status: 'draft' }, data: { status: 'sent', acceptTokenHash: tokenHash(token) } });
   if (!changed.count) throw new ConflictException('Quote is not a draft');
   const q = await tx.commerceQuote.findUniqueOrThrow({ where: { id } });
   await tx.crmLead.update({ where: { id: q.leadId }, data: { stage: 'proposal_sent' } });
   await activity(tx, q.leadId, 'quote.sent', `quote=${id}`, who.sub);
   // The token is returned once (only its hash is stored); it goes into the acceptance link sent to the customer.
   return { quote: id, acceptToken: token, acceptUrl: `${process.env.PUBLIC_APP_URL ?? 'https://app.atlashub.si'}/proposta/${token}` };
  });
 }

 // ---------- Customer billing (customer tenant members) ----------
 @Get('v1/billing/invoices') async invoices(@Req() req: any, @Query('tenant') tenant?: string) {
  const who = await identity(req, tenant);
  return withDb({ tenantId: who.tenantId, userId: who.sub }, async tx => (await tx.billingInvoice.findMany({ where: { tenantId: who.tenantId }, orderBy: { createdAt: 'desc' } })).map(v => ({ ...v, subtotalMinor: toNumber(v.subtotalMinor), taxMinor: toNumber(v.taxMinor), totalMinor: toNumber(v.totalMinor) })));
 }
 @Get('v1/billing/invoices/:id/document') async document(@Req() req: any, @Res() res: any, @Param('id') id: string, @Query('tenant') tenant?: string) {
  const who = await identity(req, tenant);
  const html = await withDb({ tenantId: who.tenantId, userId: who.sub }, tx => invoiceDocument(tx, who.tenantId, id));
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); res.send(html);
 }

 // ---------- Payment provider webhooks ----------
 @Post('v1/webhooks/payments/:provider') @HttpCode(200) async webhook(@Req() req: any, @Param('provider') provider: string, @Body() body: unknown) {
  const adapter = ADAPTERS[provider]; if (!adapter || !adapter.configured()) throw new NotFoundException();
  const event = adapter.verifyWebhook(req.rawBody as Buffer, req.headers, body);
  if (!event) throw new UnauthorizedException();
  const id = randomUUID();
  const stored = await withDb({ scope: 'billing_webhook' }, async tx => {
   const created = await tx.billingWebhookEvent.createMany({ data: [{ id, provider, eventId: event.eventId, eventType: event.eventType, providerRef: event.providerRef, payloadSha256: createHash('sha256').update(req.rawBody as Buffer).digest('hex'), facts: event.facts as Prisma.InputJsonValue }], skipDuplicates: true });
   return created.count ? id : null;
  });
  if (stored) await billingQueue.add('webhook', { eventId: stored }, { jobId: `wh-${stored}`, attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: false, removeOnFail: false });
  return { received: true, duplicate: !stored };
 }
}

// Gap-free numbering per issuer/year under a row lock, then an open invoice with its lines.
async function issueInvoice(tx: Tx, i: { tenantId: string; accountId: string; issuerId: string; orderId: string; currency: string; locale: string; lines: { priceId: string; description: string; quantity: number; unitMinor: bigint; amountMinor: bigint }[] }) {
 const issuer = await tx.billingIssuer.findUniqueOrThrow({ where: { id: i.issuerId } });
 const year = new Date().getUTCFullYear();
 await tx.$executeRaw`INSERT INTO "billing_invoice_sequence"("issuerId","year","last") VALUES (${issuer.id},${year},0) ON CONFLICT DO NOTHING`;
 const [seq] = await tx.$queryRaw<{ last: number }[]>`UPDATE "billing_invoice_sequence" SET "last"="last"+1 WHERE "issuerId"=${issuer.id} AND "year"=${year} RETURNING "last"`;
 const subtotal = i.lines.reduce((a, l) => a + l.amountMinor, 0n);
 const invoice = await tx.billingInvoice.create({ data: { id: randomUUID(), tenantId: i.tenantId, accountId: i.accountId, issuerId: issuer.id, orderId: i.orderId, number: invoiceNumber(issuer.series, year, seq.last), status: 'open', currency: i.currency, subtotalMinor: subtotal, taxMinor: 0n, totalMinor: subtotal, locale: i.locale, issuedAt: new Date(), dueAt: new Date(Date.now() + 7 * 864e5), legalDocumentRef: { status: 'pending_certified_issuer' } } });
 await tx.billingInvoiceLine.createMany({ data: i.lines.map(l => ({ id: randomUUID(), tenantId: i.tenantId, invoiceId: invoice.id, ...l })) });
 return invoice;
}

export async function invoiceDocument(tx: Tx, tenantId: string, id: string) {
 const v = await tx.billingInvoice.findFirst({ where: { tenantId, id } }); if (!v) throw new NotFoundException();
 const [issuer, account, lines] = await Promise.all([tx.billingIssuer.findUniqueOrThrow({ where: { id: v.issuerId } }), tx.billingAccount.findUniqueOrThrow({ where: { id: v.accountId } }), tx.billingInvoiceLine.findMany({ where: { tenantId, invoiceId: id } })]);
 return renderInvoiceHtml({ ...v, locale: asLocale(v.locale), issuer, account, lines });
}

// Creates a provider checkout for an open invoice and records the pending payment in the customer tenant.
export async function startPayment(tenantId: string, invoiceId: string) {
 const { invoice, account } = await withDb({ tenantId }, async tx => ({ invoice: await tx.billingInvoice.findFirstOrThrow({ where: { tenantId, id: invoiceId } }), account: await tx.billingAccount.findFirstOrThrow({ where: { tenantId } }) }));
 if (invoice.status !== 'open') throw new ConflictException('Invoice is not open');
 const adapter = chooseProvider(invoice.currency); const paymentId = randomUUID();
 const c = await adapter.createCheckout({ paymentId, invoiceNumber: invoice.number!, amountMinor: Number(invoice.totalMinor), currency: invoice.currency, email: account.email, locale: invoice.locale });
 await withDb({ tenantId }, tx => tx.billingPayment.create({ data: { id: paymentId, tenantId, invoiceId, provider: adapter.provider, providerRef: c.providerRef, method: c.method, amountMinor: invoice.totalMinor, currency: invoice.currency, checkout: c.checkout as Prisma.InputJsonValue } }));
 return { id: paymentId, provider: adapter.provider, method: c.method, checkout: c.checkout };
}
