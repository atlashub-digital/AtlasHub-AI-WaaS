// Round 2 / G1: real Supabase Auth against the Supabase-backed staging API (no synthetic HS256 tokens).
// Env: SUPABASE_URL, SUPABASE_KEY (server-side key, used only as apikey), USERS_FILE (written by
// scripts/supabase-staging-setup.sh), INBOUND_HMAC_SECRET, API_BASE (default http://127.0.0.1:4000).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHmac,randomUUID} from 'node:crypto';
const users=JSON.parse(readFileSync(process.env.USERS_FILE,'utf8'));const base=process.env.API_BASE??'http://127.0.0.1:4000';const auth=`${process.env.SUPABASE_URL}/auth/v1`;
const hdr={apikey:process.env.SUPABASE_KEY,'Content-Type':'application/json'};
async function signIn(name){const r=await fetch(`${auth}/token?grant_type=password`,{method:'POST',headers:hdr,body:JSON.stringify({email:users[name].email,password:users[name].password})});assert.equal(r.status,200,`sign in ${name}`);return r.json();}
const api=(path,token,method='GET',body)=>fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('a real Supabase session reaches only its own tenant',async()=>{
 const a=await signIn('admin-a');const b=await signIn('admin-b');
 const ra=await api('/v1/tenants/tenant-A/deployments',a.access_token);assert.equal(ra.status,200);assert.ok((await ra.json()).every(d=>d.tenantId==='tenant-A'));
 assert.equal((await api('/v1/tenants/tenant-A/deployments',b.access_token)).status,403);
 const rb=await api('/v1/tenants/tenant-B/deployments',b.access_token);assert.equal(rb.status,200);assert.ok((await rb.json()).every(d=>d.tenantId==='tenant-B'));
});
test('read-only member cannot mutate; forged, altered or missing tokens are rejected',async()=>{
 const v=await signIn('viewer-a');assert.ok([403,404].includes((await api('/v1/deployments/deployment-A/pause',v.access_token,'POST')).status));
 const a=await signIn('admin-a');const [h,p,s]=a.access_token.split('.');
 const claims=JSON.parse(Buffer.from(p,'base64url'));claims.sub=users['admin-b'].id;
 assert.equal((await api('/v1/tenants/tenant-B/deployments',`${h}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${s}`)).status,401);
 const hs=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${p}`;
 assert.equal((await api('/v1/tenants/tenant-A/deployments',`${hs}.${createHmac('sha256','guess').update(hs).digest('base64url')}`)).status,401);
 assert.equal((await api('/v1/tenants/tenant-A/deployments')).status,401);
});
test('refresh rotates the session; logout revokes the refresh token',async()=>{
 const a=await signIn('admin-a');
 const r=await fetch(`${auth}/token?grant_type=refresh_token`,{method:'POST',headers:hdr,body:JSON.stringify({refresh_token:a.refresh_token})});assert.equal(r.status,200);const fresh=await r.json();
 assert.equal((await api('/v1/tenants/tenant-A/deployments',fresh.access_token)).status,200);
 assert.equal((await fetch(`${auth}/logout?scope=global`,{method:'POST',headers:{...hdr,Authorization:`Bearer ${fresh.access_token}`}})).status,204);
 const again=await fetch(`${auth}/token?grant_type=refresh_token`,{method:'POST',headers:hdr,body:JSON.stringify({refresh_token:fresh.refresh_token})});assert.ok(again.status>=400,'refresh after logout must fail');
});
test('ROLE-001 runs end to end on Supabase under RLS and is readable only by its tenant',async()=>{
 const body=JSON.stringify({event_id:randomUUID(),channel_binding_id:'channel-A',timestamp:new Date().toISOString(),payload:{conversation_ref:'synthetic-A-1',intent_text:'Confirmo'}});
 const sent=await fetch(base+'/v1/inbound/sandbox',{method:'POST',headers:{'Content-Type':'application/json','x-atlas-signature':createHmac('sha256',process.env.INBOUND_HMAC_SECRET).update(body).digest('hex')},body});assert.equal(sent.status,202);const {runId}=await sent.json();
 const a=await signIn('admin-a');let run;for(let i=0;i<100;i++){const r=await api(`/v1/runs/${runId}?tenant=tenant-A`,a.access_token);run=await r.json();if(['completed','blocked','awaiting_approval'].includes(run.state))break;await new Promise(x=>setTimeout(x,150));}
 assert.equal(run.state,'completed');assert.ok(run.events.some(e=>e.type==='calendar.updated'));
 const b=await signIn('admin-b');assert.equal((await api(`/v1/runs/${runId}?tenant=tenant-A`,b.access_token)).status,403);
});
