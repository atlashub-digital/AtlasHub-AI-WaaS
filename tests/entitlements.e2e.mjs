// Entitlements through the real path (API + worker with ENTITLEMENTS_ENFORCE=1, runtime role, RLS).
// Requires seed.mjs, seed-roles.mjs and seed-pilots.mjs. Leaves the fixtures as it found them.
import test from 'node:test';import assert from 'node:assert/strict';import {createHmac,randomUUID} from 'node:crypto';import {SignJWT} from 'jose';import {Queue} from 'bullmq';import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});const base='http://127.0.0.1:4000';
const queue=new Queue('tasks',{connection:{host:process.env.REDIS_HOST??'127.0.0.1',port:Number(process.env.REDIS_PORT??6379)}});
async function token(sub){return new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(sub).setIssuer(process.env.JWT_ISSUER).setAudience(process.env.JWT_AUDIENCE).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.STAGING_JWT_SECRET));}
// The API rate-limits POSTs per address (120/min); suites run back to back in CI, so wait out the window.
async function unthrottled(send){for(let i=0;i<40;i++){const r=await send();if(r.status!==429)return r;await new Promise(x=>setTimeout(x,2000));}throw new Error('rate limited');}
async function api(path,sub='admin-A',method='GET',body){const auth=await token(sub);const r=await unthrottled(()=>fetch(base+path,{method,headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,body:await r.json().catch(()=>null)};}
async function inbound(channel,text){const body=JSON.stringify({event_id:randomUUID(),channel_binding_id:channel,timestamp:new Date().toISOString(),payload:{conversation_ref:`ent-${randomUUID().slice(0,8)}`,intent_text:text}});const r=await unthrottled(()=>fetch(base+'/v1/inbound/sandbox',{method:'POST',headers:{'Content-Type':'application/json','x-atlas-signature':createHmac('sha256',process.env.INBOUND_HMAC_SECRET).update(body).digest('hex')},body}));assert.equal(r.status,202);return r.json();}
async function settled(id,states){for(let i=0;i<100;i++){const run=await db.taskRun.findUnique({where:{id}});if(states.includes(run?.state))return run;await new Promise(x=>setTimeout(x,100));}throw new Error(`run ${id} did not settle`);}
const workforceB={tenantId_key_source_sourceId:{tenantId:'tenant-B',key:'module.workforce',source:'grant',sourceId:'seed'}};
const setWorkforceB=status=>db.commerceEntitlement.update({where:workforceB,data:{status}});
test.after(async()=>{await setWorkforceB('active');await db.commerceEntitlement.updateMany({where:{tenantId:'tenant-A',key:'module.ami',source:'grant',sourceId:'ops'},data:{status:'revoked'}});await queue.close();await db.$disconnect();});

test('GET /v1/entitlements returns active modules of the caller\'s tenant only',async()=>{
 const a=await api('/v1/entitlements?tenant=tenant-A');assert.equal(a.status,200);assert.equal(a.body.tenantId,'tenant-A');assert.equal(a.body.enforced,true);assert.ok(a.body.modules.includes('workforce'));
 assert.ok(a.body.items.every(i=>!('sourceId' in i)&&!('tenantId' in i)),'no internal identifiers');
 assert.equal((await api('/v1/entitlements?tenant=tenant-A','admin-B')).status,403);
 assert.equal((await fetch(base+'/v1/entitlements?tenant=tenant-A')).status,401);
});
test('GET /v1/me lists only the caller\'s memberships, each with its modules',async()=>{
 const me=await api('/v1/me','admin-A');assert.equal(me.status,200);assert.equal(me.body.sub,'admin-A');
 assert.deepEqual(me.body.memberships.map(m=>m.tenantId),['tenant-A']);assert.deepEqual(me.body.memberships[0].modules.includes('workforce'),true);
 const pilot=await api('/v1/me','pilot-a-sandbox:admin');assert.deepEqual(pilot.body.memberships.map(m=>[m.tenantId,m.modules]),[['pilot-a-sandbox',['workforce','ami']]]);
 const qa=await api('/v1/me','atlas-synthetic-qa:viewer');assert.deepEqual(qa.body.memberships.map(m=>[m.tenantId,m.role,m.modules]),[['atlas-synthetic-qa','tenant_user',['workforce']]]);
 const none=await api('/v1/me','nobody-'+randomUUID());assert.equal(none.status,200);assert.deepEqual(none.body.memberships,[]);
});
test('pilot tenants are isolated from each other and from A/B',async()=>{
 for(const [sub,tenant] of [['pilot-a-sandbox:admin','pilot-b-sandbox'],['pilot-b-sandbox:admin','atlas-synthetic-qa'],['atlas-synthetic-qa:viewer','tenant-A'],['admin-A','pilot-c-sandbox']]){
  assert.equal((await api(`/v1/entitlements?tenant=${tenant}`,sub)).status,403,`${sub} → ${tenant}`);
  assert.equal((await api(`/v1/runs?tenant=${tenant}`,sub)).status,403);
  assert.equal((await api(`/v1/tenants/${tenant}/deployments`,sub)).status,403);
 }
});
test('only Atlas operators of the tenant grant or revoke a module, and it is audited',async()=>{
 assert.equal((await api('/v1/ops/entitlements','viewer-A','POST',{tenant:'tenant-A',module:'ami'})).status,403);
 assert.equal((await api('/v1/ops/entitlements','admin-A','POST',{tenant:'tenant-A',module:'ami'})).status,403,'tenant admins cannot grant themselves modules');
 assert.equal((await api('/v1/ops/entitlements','operator-A','POST',{tenant:'tenant-B',module:'ami'})).status,403,'no cross-tenant grant');
 assert.equal((await api('/v1/ops/entitlements','operator-A','POST',{tenant:'tenant-A',module:'billing'})).status,400,'closed module list');
 const g=await api('/v1/ops/entitlements','operator-A','POST',{tenant:'tenant-A',module:'ami'});assert.equal(g.status,201);assert.equal(g.body.key,'module.ami');assert.equal(g.body.source,'grant');
 assert.ok((await api('/v1/entitlements?tenant=tenant-A')).body.modules.includes('ami'));
 assert.ok(await db.auditEvent.count({where:{tenantId:'tenant-A',action:'entitlement.grant',objectId:g.body.id}}));
 // An independent grant of the same module (e.g. a seed or another provisioning source) must survive the revocation.
 const other=await db.commerceEntitlement.create({data:{id:randomUUID(),tenantId:'tenant-A',key:'module.ami',source:'grant',sourceId:'seed-independent'}});
 try{
  const r=await api('/v1/ops/entitlements/revoke','operator-A','POST',{tenant:'tenant-A',module:'ami'});assert.equal(r.status,201);assert.equal(r.body.revoked,1);
  assert.equal((await db.commerceEntitlement.findUnique({where:{id:other.id}})).status,'active','independent grant untouched');
  assert.equal((await db.commerceEntitlement.findUnique({where:{id:g.body.id}})).status,'revoked');
  assert.ok((await api('/v1/entitlements?tenant=tenant-A')).body.modules.includes('ami'),'module stays on through the independent grant');
 }finally{await db.commerceEntitlement.delete({where:{id:other.id}});}
 assert.ok(!(await api('/v1/entitlements?tenant=tenant-A')).body.modules.includes('ami'));
});
test('API refuses new deployments without an entitlement for the role',async()=>{
 await setWorkforceB('revoked');
 const release=await db.packRelease.findFirst({where:{packId:'PACK-002'}});
 const r=await api('/v1/deployments','operator-B','POST',{tenantId:'tenant-B',roleId:'ROLE-002',packReleaseId:release.id,config:{business_name:'Empresa Fictícia B',handoff_queue:'operator-B'},limits:{dailyRuns:10,alertAt:8}});
 assert.equal(r.status,403);assert.equal(r.body.error,'entitlement_required');
 await setWorkforceB('active');
});
test('inbound keeps the event but suspends the run when the tenant is not entitled',async()=>{
 await setWorkforceB('revoked');
 const run=await inbound('channel-B','Confirmo');assert.equal(run.state,'suspended');
 const row=await db.taskRun.findUnique({where:{id:run.runId}});assert.equal(row.result.reason,'entitlement_missing');
 assert.equal(await queue.getJob(run.runId),undefined,'never queued');
 await setWorkforceB('active');
 assert.equal((await inbound('channel-B','Confirmo')).state,'queued','re-entitled tenant runs again');
});
test('worker re-checks at execution: a run queued before revocation is blocked',async()=>{
 const deployment=await db.deployment.findUnique({where:{id:'deployment-B'}});
 await setWorkforceB('revoked');
 const id=randomUUID();await db.taskRun.create({data:{id,tenantId:'tenant-B',deploymentId:deployment.id,externalEventId:id,idempotencyKey:id,correlationId:id,input:{conversation_ref:'synthetic-B-1',intent_text:'Confirmo'},state:'queued'}});
 await queue.add('execute',{runId:id},{jobId:id});
 const run=await settled(id,['blocked','completed']);assert.equal(run.state,'blocked');assert.equal(run.result.reason,'entitlement_expired');
 assert.ok(await db.taskEvent.count({where:{runId:id,type:'policy.denied'}}));
 assert.equal(await db.toolEffect.count({where:{runId:id}}),0,'no side effects');
 await setWorkforceB('active');
});
