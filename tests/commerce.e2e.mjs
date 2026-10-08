// Phase B end to end: catalogue → simulation → lead → free trial (approve, expire) → quote → acceptance →
// invoice → sandbox payment webhook → entitlements and mission; lead injection; isolation.
// Requires API + worker (staging), seed + seed-commerce, PAYMENTS_MODE=sandbox and SANDBOX_PAYMENTS_SECRET.
import test from 'node:test';import assert from 'node:assert/strict';import {createHmac,randomUUID} from 'node:crypto';import {SignJWT} from 'jose';import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});const base='http://127.0.0.1:4000';const id=()=>randomUUID().slice(0,8);
const CONSENT='v1-2026-10';
async function token(sub){return new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(sub).setIssuer(process.env.JWT_ISSUER).setAudience(process.env.JWT_AUDIENCE).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.STAGING_JWT_SECRET));}
async function call(path,{sub,method='GET',body,headers={}}={}){const r=await fetch(base+path,{method,headers:{...(sub?{Authorization:`Bearer ${await token(sub)}`}:{}),'Content-Type':'application/json',...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});const text=await r.text();let json=null;try{json=JSON.parse(text);}catch{}return {status:r.status,body:json,text};}
const until=async(fn,ms=15000)=>{const end=Date.now()+ms;for(;;){const v=await fn();if(v)return v;if(Date.now()>end)throw new Error('timeout');await new Promise(r=>setTimeout(r,250));}};
function sandboxWebhook(payload){const raw=JSON.stringify(payload);const t=Math.floor(Date.now()/1000);return {raw,headers:{'x-sandbox-signature':`t=${t},v1=${createHmac('sha256',process.env.SANDBOX_PAYMENTS_SECRET).update(`${t}.${raw}`).digest('hex')}`}};}
const person=(extra={})=>({fullName:'Pessoa de Teste',email:`lead.${id()}@example.test`,company:'Clínica Teste',companyDomain:`clinica-${id()}.example.test`,country:'BR',sizeBand:'medium',interestRoles:['ROLE-001'],locale:'pt-BR',consent:true,consentTextVersion:CONSENT,...extra});
let testPrice;
test.before(async()=>{testPrice=`test-price-${id()}`;await db.catalogPrice.create({data:{id:testPrice,productId:'prd-001-mission',currency:'BRL',pricingModel:'flat',interval:'month',amountMinor:150000n,status:'active'}});});
test.after(async()=>{await db.catalogPrice.update({where:{id:testPrice},data:{status:'retired'}});await db.$disconnect();});

test('public catalogue serves 8 templates in 5 locales and never shows draft prices',async()=>{
 const br=await call('/v1/public/catalog?locale=pt-BR&currency=BRL');assert.equal(br.status,200);assert.equal(br.body.templates.length,8);
 assert.equal(br.body.templates.find(t=>t.roleId==='ROLE-001').name,'Recepcionista Digital');
 const fr=await call('/v1/public/catalog?locale=fr&currency=EUR');assert.equal(fr.body.templates.find(t=>t.roleId==='ROLE-008').name,'Assistant RH');
 assert.ok(fr.body.products.every(p=>p.prices.every(x=>x.amountMinor!==null)));assert.equal(fr.body.products.flatMap(p=>p.prices).length,0);
 const consent=await call('/v1/public/consent-text?purpose=trial&locale=es');assert.equal(consent.body.version,CONSENT);assert.match(consent.body.text,/prueba gratuita/);
});
test('simulation returns an explainable hypothesis and a price only when approved',async()=>{
 const s=await call('/v1/public/simulate',{method:'POST',body:{roleId:'ROLE-001',templateId:'tpl-001-standard',currency:'BRL',locale:'pt-BR',volumePerMonth:600,minutesPerTask:5,automatablePct:60}});
 assert.equal(s.status,200);assert.equal(s.body.hoursSaved,30);assert.equal(s.body.monthlyPriceMinor,150000);assert.match(s.body.disclaimer,/Hipótese/);
 const eur=await call('/v1/public/simulate',{method:'POST',body:{roleId:'ROLE-001',templateId:'tpl-001-standard',currency:'EUR',locale:'en',volumePerMonth:600,minutesPerTask:5,automatablePct:60}});assert.equal(eur.body.monthlyPriceMinor,null);
});
test('lead capture: consent evidence, deduplication, honeypot and stale consent text are handled',async()=>{
 const p=person({simulation:{volumePerMonth:600}});
 assert.equal((await call('/v1/public/leads',{method:'POST',body:p})).status,202);assert.equal((await call('/v1/public/leads',{method:'POST',body:{...p,phone:'(62) 99999-0000'}})).status,202);
 const contacts=await db.crmContact.findMany({where:{tenantId:'atlashub',emailNorm:p.email}});assert.equal(contacts.length,1);
 assert.equal(await db.crmLead.count({where:{tenantId:'atlashub',contactId:contacts[0].id}}),1);
 const consents=await db.crmConsent.findMany({where:{contactId:contacts[0].id}});assert.equal(consents.length,2);assert.match(consents[0].evidence.text,/Autorizo a AtlasHub/);
 const bot=person();assert.equal((await call('/v1/public/leads',{method:'POST',body:{...bot,website:'x'}})).status,400);
 const stale=person();assert.equal((await call('/v1/public/leads',{method:'POST',body:{...stale,consentTextVersion:'v0'}})).status,202);assert.equal(await db.crmContact.count({where:{emailNorm:stale.email}}),0);
 assert.equal((await call('/v1/public/leads',{method:'POST',body:{...person(),consent:false}})).status,400);
});
test('free trial: request once, operator approval creates a time-boxed entitlement, expiry closes it',async()=>{
 const p=person();const req={...p,templateId:'tpl-001-standard',days:7};
 const r1=await call('/v1/public/trials',{method:'POST',body:req});assert.equal(r1.status,202);const ref=r1.body.trial.reference;
 assert.equal((await call('/v1/public/trials',{method:'POST',body:req})).body.trial.reference,ref);
 assert.equal((await call(`/v1/ops/trials/${ref}/approve`,{sub:'admin-A',method:'POST'})).status,403);
 const ok=await call(`/v1/ops/trials/${ref}/approve`,{sub:'house-operator',method:'POST'});assert.equal(ok.status,200);
 const ent=await db.commerceEntitlement.findFirst({where:{tenantId:ok.body.tenant,source:'trial',sourceId:ref}});assert.equal(ent.key,'mission.tpl-001-standard');
 assert.ok(Math.abs(ent.validUntil.getTime()-Date.now()-7*864e5)<60e3);assert.equal((await db.commerceMission.findFirst({where:{tenantId:ok.body.tenant}})).status,'provisioning');
 assert.equal((await call(`/v1/ops/trials/${ref}/approve`,{sub:'house-operator',method:'POST'})).status,409);
 await db.commerceTrial.update({where:{id:ref},data:{endsAt:new Date(Date.now()-1000)}});
 await until(async()=>(await db.commerceTrial.findUnique({where:{id:ref}})).status==='expired',20000);
 assert.equal((await db.commerceEntitlement.findFirst({where:{id:ent.id}})).status,'expired');
});
test('quote → acceptance → invoice → verified payment unlocks entitlement and mission exactly once',async()=>{
 const p=person();await call('/v1/public/leads',{method:'POST',body:p});
 const lead=await db.crmLead.findFirst({where:{tenantId:'atlashub',contactId:(await db.crmContact.findFirst({where:{emailNorm:p.email}})).id}});
 const q=await call('/v1/ops/quotes',{sub:'house-operator',method:'POST',body:{leadId:lead.id,currency:'BRL',locale:'pt-BR',country:'BR',lines:[{priceId:testPrice,quantity:1}]}});assert.equal(q.status,201);assert.equal(q.body.totalMinor,150000);assert.equal(q.body.issuerId,'atlashub-br');
 assert.equal((await call('/v1/ops/quotes',{sub:'house-operator',method:'POST',body:{leadId:lead.id,currency:'BRL',locale:'pt-BR',lines:[{priceId:'prd-001-mission-brl-month',quantity:1}]}})).status,400);
 const sent=await call(`/v1/ops/quotes/${q.body.id}/send`,{sub:'house-operator',method:'POST'});assert.equal(sent.status,200);
 const acc=await call('/v1/public/quotes/accept',{method:'POST',body:{token:sent.body.acceptToken,acceptedBy:'Pessoa de Teste',billing:{legalName:'Clínica Teste Ltda',country:'BR',email:'financeiro@example.test',address:{city:'Goiânia'}}}});
 assert.equal(acc.status,201);assert.match(acc.body.invoice.number,/^AH-BR-\d{4}-\d{6}$/);assert.equal(acc.body.payment.provider,'sandbox');assert.equal(acc.body.payment.method,'pix');assert.match(acc.body.payment.checkout.qr_code,/^SANDBOX-PIX-/);
 assert.equal((await call('/v1/public/quotes/accept',{method:'POST',body:{token:sent.body.acceptToken,acceptedBy:'Outra Pessoa',billing:{legalName:'Outra Empresa',country:'BR',email:'x@example.test'}}})).status,404);
 const tenant=acc.body.tenant;const ref=`sbx_${acc.body.payment.id}`;
 const bad=sandboxWebhook({id:`evt_${id()}`,type:'payment.updated',payment_ref:ref,status:'succeeded',amount_minor:150000,currency:'BRL'});
 assert.equal((await call('/v1/webhooks/payments/sandbox',{method:'POST',body:bad.raw,headers:{'x-sandbox-signature':'t=1,v1=00'}})).status,401);
 const wrong=sandboxWebhook({id:`evt_${id()}`,type:'payment.updated',payment_ref:ref,status:'succeeded',amount_minor:1,currency:'BRL'});
 assert.equal((await call('/v1/webhooks/payments/sandbox',{method:'POST',body:wrong.raw,headers:wrong.headers})).status,200);
 await until(async()=>(await db.billingWebhookEvent.findFirst({where:{provider:'sandbox',eventId:JSON.parse(wrong.raw).id}}))?.status==='failed');
 assert.equal((await db.billingInvoice.findFirst({where:{tenantId:tenant}})).status,'open');
 const good=sandboxWebhook({id:`evt_${id()}`,type:'payment.updated',payment_ref:ref,status:'succeeded',amount_minor:150000,currency:'BRL'});
 assert.equal((await call('/v1/webhooks/payments/sandbox',{method:'POST',body:good.raw,headers:good.headers})).body.duplicate,false);
 assert.equal((await call('/v1/webhooks/payments/sandbox',{method:'POST',body:good.raw,headers:good.headers})).body.duplicate,true);
 await until(async()=>(await db.billingInvoice.findFirst({where:{tenantId:tenant}})).status==='paid');
 const ent=await db.commerceEntitlement.findMany({where:{tenantId:tenant}});assert.equal(ent.length,1);assert.equal(ent[0].key,'mission.tpl-001-standard');assert.equal(ent[0].source,'subscription');
 assert.equal((await db.commerceSubscription.findFirst({where:{tenantId:tenant}})).status,'active');assert.equal(await db.commerceMission.count({where:{tenantId:tenant,source:'order'}}),1);
 assert.equal((await db.crmLead.findUnique({where:{id:lead.id}})).stage,'won');
 await db.membership.create({data:{tenantId:tenant,userId:'customer-admin',role:'tenant_admin'}});
 const list=await call(`/v1/billing/invoices?tenant=${tenant}`,{sub:'customer-admin'});assert.equal(list.body[0].totalMinor,150000);
 const doc=await call(`/v1/billing/invoices/${list.body[0].id}/document?tenant=${tenant}`,{sub:'customer-admin'});assert.equal(doc.status,200);assert.ok(doc.text.includes(acc.body.invoice.number));assert.match(doc.text,/nota fiscal/);
 assert.equal((await call(`/v1/billing/invoices?tenant=${tenant}`,{sub:'admin-A'})).status,403);
});
test('lead injection: lawful basis required; duplicates, invalid and suppressed rows never become leads',async()=>{
 const existing=person();await call('/v1/public/leads',{method:'POST',body:existing});
 const sup=person();await call('/v1/public/leads',{method:'POST',body:sup});
 const supLead=await db.crmLead.findFirst({where:{contactId:(await db.crmContact.findFirst({where:{emailNorm:sup.email}})).id}});
 assert.equal((await call(`/v1/ops/crm/leads/${supLead.id}/suppress`,{sub:'house-operator',method:'POST'})).status,200);
 const fresh=`novo.${id()}@example.test`;
 const rows=[{fullName:'Novo Contacto',email:fresh,locale:'pt-PT'},{fullName:'Duplicado',email:existing.email},{fullName:'Sem contacto'},{fullName:'Suprimido',email:sup.email},{fullName:'Repetido',email:fresh}];
 assert.equal((await call('/v1/ops/crm/imports',{sub:'house-operator',method:'POST',body:{source:'event',lawfulBasis:'legitimate_interest',rows}})).status,400);
 const b=await call('/v1/ops/crm/imports',{sub:'house-operator',method:'POST',body:{source:'event',lawfulBasis:'legitimate_interest',basisNote:'Contactos recolhidos com aviso de privacidade no evento X',rows}});
 assert.equal(b.status,201);assert.deepEqual([b.body.rowsValid,b.body.rowsDuplicate,b.body.rowsRejected,b.body.rowsSuppressed],[1,2,1,1]);
 assert.equal((await call(`/v1/ops/crm/imports/${b.body.id}/commit`,{sub:'house-operator',method:'POST'})).body.imported,1);
 assert.equal((await call(`/v1/ops/crm/imports/${b.body.id}/commit`,{sub:'house-operator',method:'POST'})).status,409);
 assert.equal(await db.crmContact.count({where:{tenantId:'atlashub',emailNorm:fresh}}),1);
});
test('pipeline rules and isolation: invalid moves rejected, customers cannot read the house CRM',async()=>{
 const p=person();await call('/v1/public/leads',{method:'POST',body:p});
 const lead=await db.crmLead.findFirst({where:{contactId:(await db.crmContact.findFirst({where:{emailNorm:p.email}})).id}});
 assert.equal((await call(`/v1/ops/crm/leads/${lead.id}/stage`,{sub:'house-operator',method:'POST',body:{stage:'won'}})).status,400);
 assert.equal((await call(`/v1/ops/crm/leads/${lead.id}/stage`,{sub:'house-operator',method:'POST',body:{stage:'contacted'}})).status,201);
 assert.equal((await call('/v1/ops/crm/leads',{sub:'admin-A'})).status,403);
 const leads=await call('/v1/ops/crm/leads?stage=contacted',{sub:'house-operator'});assert.ok(leads.body.some(l=>l.id===lead.id));
});
