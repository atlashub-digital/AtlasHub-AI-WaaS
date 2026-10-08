// Round 2 / G1: negative A/B tests over the real backend connection role (waas_runtime).
// Requires APP_DATABASE_URL (runtime role) and the synthetic fixtures from scripts/seed.mjs.
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
const client=new pg.Client({connectionString:process.env.APP_DATABASE_URL});await client.connect();
async function inCtx(ctx,fn){await client.query('BEGIN');try{await client.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.user_id',$2,true),set_config('app.scope',$3,true)",[ctx.tenantId??'',ctx.userId??'',ctx.scope??'']);return await fn();}finally{await client.query('ROLLBACK');}}
const count=async(sql,params=[])=>(await client.query(sql,params)).rows[0].n;
test('runtime role cannot bypass RLS, own tables or read migration history',async()=>{
 const {rows:[r]}=await client.query("SELECT rolsuper,rolbypassrls,(SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tableowner=current_user) owned FROM pg_roles WHERE rolname=current_user");
 assert.deepEqual([r.rolsuper,r.rolbypassrls,r.owned],[false,false,0]);
 await assert.rejects(client.query('SELECT * FROM waas_migrations'),e=>e.code==='42501');
 await assert.rejects(client.query('CREATE TABLE public.rls_probe(x int)'),e=>e.code==='42501');
});
test('without context no tenant data is visible',async()=>inCtx({},async()=>{
 for(const t of ['TaskRun','Deployment','Membership','Appointment','ChannelBinding','Approval','AuditEvent','Tenant'])assert.equal(await count(`SELECT count(*)::int n FROM "${t}"`),0,t);
}));
test('tenant A sees only tenant A and cannot read, write or move rows of tenant B',async()=>inCtx({tenantId:'tenant-A'},async()=>{
 assert.ok(await count('SELECT count(*)::int n FROM "Appointment"')>0);
 for(const t of ['TaskRun','Deployment','Membership','Appointment','ChannelBinding','CalendarSlot','ToolGrant'])assert.equal(await count(`SELECT count(*)::int n FROM "${t}" WHERE "tenantId"='tenant-B'`),0,t);
 assert.equal(await count('SELECT count(*)::int n FROM "Tenant" WHERE id<>$1',['tenant-A']),0);
 assert.equal((await client.query(`UPDATE "Appointment" SET status='cancelled' WHERE "tenantId"='tenant-B'`)).rowCount,0);
 assert.equal((await client.query(`DELETE FROM "CalendarSlot" WHERE "tenantId"='tenant-B'`)).rowCount,0);
 await client.query('SAVEPOINT s');
 await assert.rejects(client.query(`INSERT INTO "AuditEvent"(id,"tenantId","actorId",action,"objectId") VALUES (gen_random_uuid()::text,'tenant-B','x','probe','x')`),e=>e.code==='42501');
 await client.query('ROLLBACK TO SAVEPOINT s');
 await assert.rejects(client.query(`UPDATE "Appointment" SET "tenantId"='tenant-B' WHERE "tenantId"='tenant-A'`),e=>e.code==='42501');
}));
test('user context sees only that user\'s memberships',async()=>inCtx({userId:'admin-A'},async()=>{
 const {rows}=await client.query('SELECT "tenantId","userId" FROM "Membership"');
 assert.ok(rows.length>0);assert.ok(rows.every(r=>r.userId==='admin-A'&&r.tenantId==='tenant-A'));
}));
test('narrow scopes are read-only and limited to their table',async()=>{
 await inCtx({scope:'inbound'},async()=>{assert.equal(await count('SELECT count(*)::int n FROM "ChannelBinding" WHERE id=$1',['channel-B']),1);assert.equal(await count('SELECT count(*)::int n FROM "TaskRun"'),0);assert.equal((await client.query(`UPDATE "ChannelBinding" SET status='disabled'`)).rowCount,0);});
 await inCtx({scope:'worker'},async()=>{assert.equal(await count('SELECT count(*)::int n FROM "Appointment"'),0);assert.equal((await client.query(`UPDATE "TaskRun" SET state='cancelled'`)).rowCount,0);});
 await inCtx({scope:'resolve'},async()=>{assert.equal(await count('SELECT count(*)::int n FROM "Approval"'),0);assert.equal((await client.query(`UPDATE "Deployment" SET state='paused'`)).rowCount,0);});
});
test('catalogue is readable but not writable',async()=>inCtx({},async()=>{
 assert.ok(await count('SELECT count(*)::int n FROM "Role"')>0);
 await assert.rejects(client.query(`UPDATE "Role" SET name='x'`),e=>e.code==='42501');
}));
test.after(async()=>client.end());
