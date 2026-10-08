// Phase B unit tests: provider signatures, normalisation, simulation, invoice rendering.
import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {verifyStripeSignature,verifyMercadoPagoSignature} from '../dist/packages/commerce/payments.js';
import {normPhone,simulate,fitScore,leadInput,STAGE_MOVES} from '../dist/packages/commerce/funnel.js';
import {renderInvoiceHtml,invoiceNumber,money} from '../dist/packages/commerce/invoice.js';
import {pick,CONSENT_TEXT,COMMERCE_LOCALES,currencyFor} from '../dist/packages/commerce/i18n.js';
const secret='whsec_synthetic_secret_for_tests_only';const now=()=>Math.floor(Date.now()/1000);
test('Stripe signature: valid, tampered, wrong secret and stale are distinguished',()=>{
 const raw=Buffer.from('{"id":"evt_1","type":"checkout.session.completed"}');const t=now();const sig=`t=${t},v1=${createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex')}`;
 assert.equal(verifyStripeSignature(raw,sig,secret),true);
 assert.equal(verifyStripeSignature(Buffer.from(raw.toString().replace('evt_1','evt_2')),sig,secret),false);
 assert.equal(verifyStripeSignature(raw,sig,'whsec_other_secret_value_xxxxxxx'),false);
 const old=t-3600;assert.equal(verifyStripeSignature(raw,`t=${old},v1=${createHmac('sha256',secret).update(`${old}.${raw}`).digest('hex')}`,secret),false);
 assert.equal(verifyStripeSignature(raw,undefined,secret),false);
});
test('Mercado Pago signature follows the id;request-id;ts manifest',()=>{
 const ts=now();const v1=createHmac('sha256',secret).update(`id:12345;request-id:req-1;ts:${ts};`).digest('hex');
 assert.equal(verifyMercadoPagoSignature('12345','req-1',`ts=${ts},v1=${v1}`,secret),true);
 assert.equal(verifyMercadoPagoSignature('12346','req-1',`ts=${ts},v1=${v1}`,secret),false);
 assert.equal(verifyMercadoPagoSignature('12345','req-2',`ts=${ts},v1=${v1}`,secret),false);
});
test('phone numbers normalise to E.164 by locale and reject garbage',()=>{
 assert.equal(normPhone('(62) 99999-1234','pt-BR'),'+5562999991234');assert.equal(normPhone('912 345 678','pt-PT'),'+351912345678');
 assert.equal(normPhone('+44 20 7946 0958','en'),'+442079460958');assert.equal(normPhone('12','pt-BR'),null);assert.equal(normPhone('5551234','en'),null);
});
test('simulation is an explainable hypothesis; score ignores personal attributes',()=>{
 assert.deepEqual(simulate({roleId:'ROLE-001',locale:'pt-BR',currency:'BRL',volumePerMonth:600,minutesPerTask:5,automatablePct:60}),{hoursSaved:30,teamCostSavedMinor:null});
 assert.equal(simulate({roleId:'ROLE-001',locale:'pt-BR',currency:'BRL',volumePerMonth:600,minutesPerTask:5,automatablePct:60,hourlyCostMinor:4000}).teamCostSavedMinor,120000);
 assert.equal(fitScore({sizeBand:'medium',interestRoles:['ROLE-001','ROLE-002'],simulation:{volumePerMonth:1200}}),85);
});
test('lead input requires explicit consent and rejects unknown fields',()=>{
 const base={fullName:'Pessoa Teste',email:'p@example.test',consent:true,consentTextVersion:'v1-2026-10'};
 assert.ok(leadInput.safeParse(base).success);assert.ok(!leadInput.safeParse({...base,consent:false}).success);assert.ok(!leadInput.safeParse({...base,age:40}).success);
});
test('stage moves cannot jump to won manually',()=>{for(const moves of Object.values(STAGE_MOVES))assert.ok(!moves.includes('won'));});
test('five locales with consent text and fallback',()=>{
 assert.deepEqual([...COMMERCE_LOCALES],['pt-BR','pt-PT','en','es','fr']);for(const l of COMMERCE_LOCALES)assert.ok(CONSENT_TEXT.trial[l].length>20);
 assert.equal(pick([{locale:'en'},{locale:'pt-PT'}],'pt-BR').locale,'pt-PT');assert.equal(pick([{locale:'en'}],'fr').locale,'en');
});
test('invoice document escapes content, formats money per locale and carries the test notice',()=>{
 const doc={number:invoiceNumber('AH-BR',2026,7),status:'open',currency:'BRL',locale:'pt-BR',issuedAt:new Date('2026-10-09'),dueAt:null,subtotalMinor:150000n,taxMinor:0n,totalMinor:150000n,issuer:{legalName:'AtlasHub Brasil',taxId:'CNPJ',country:'BR',address:{},email:'f@x.test'},account:{legalName:'<script>x</script>',taxId:null,country:'BR',email:'c@x.test',address:{}},lines:[{description:'Missão',quantity:1,unitMinor:150000n,amountMinor:150000n}]};
 const html=renderInvoiceHtml(doc);
 assert.equal(doc.number,'AH-BR-2026-000007');assert.ok(!html.includes('<script>x'));assert.ok(html.includes(money(150000,'BRL','pt-BR')));assert.match(html,/Não substitui a nota fiscal/);
});
test('market currency: Brazil BRL, Europe EUR, rest of the world USD',()=>{
 assert.equal(currencyFor('BR'),'BRL');assert.equal(currencyFor('pt'),'EUR');assert.equal(currencyFor('GB'),'EUR');assert.equal(currencyFor('US'),'USD');assert.equal(currencyFor('AO'),'USD');
 assert.equal(currencyFor(null,'pt-BR'),'BRL');assert.equal(currencyFor(null,'fr'),'EUR');assert.equal(currencyFor(null,'en'),'USD');
});
