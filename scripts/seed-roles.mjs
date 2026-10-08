// Round 2: synthetic deployments, channels and sandbox systems for ROLE-002..008 in tenants A/B.
// Same guard as scripts/seed.mjs: only the isolated waas_staging database, fictitious data, no deletes.
import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';import {createHash,randomUUID} from 'node:crypto';
import {ROLES,ROLE_BINDINGS,roleManifest} from '../dist/packages/roles/index.js';
if(process.env.AUTH_MODE!=='staging'||!process.env.DATABASE_URL?.includes('/waas_staging'))throw new Error('Seed only for isolated waas_staging database');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const day=864e5,future=n=>new Date(Date.now()+n*day).toISOString();
const fixtures={
 slot:i=>Object.fromEntries([1,2,3,4,5,6].map(n=>[`slot-${i}-${n}`,{starts_at:future(7+n),booked:false}])),
 property:()=>({'prop-lisboa-t2':{city:'Lisboa',price:320000,currency:'EUR',bedrooms:2,available:true},'prop-lisboa-t3':{city:'Lisboa',price:450000,currency:'EUR',bedrooms:3,available:true},'prop-porto-t1':{city:'Porto',price:190000,currency:'EUR',bedrooms:1,available:true},'prop-porto-t2-sold':{city:'Porto',price:250000,currency:'EUR',bedrooms:2,available:false}}),
 order:t=>({[`ORD-${t}-1001`]:{email:`cliente.${t.toLowerCase()}@example.test`,status:'delivered',delivered_at:future(-5),total:4990,currency:'EUR',carrier:'CTT'},[`ORD-${t}-1002`]:{email:`cliente.${t.toLowerCase()}@example.test`,status:'shipped',total:12900,currency:'EUR',carrier:'DPD'},[`ORD-${t}-1003`]:{email:`outro.${t.toLowerCase()}@example.test`,status:'delivered',delivered_at:future(-60),total:2500,currency:'EUR'}}),
 faq:()=>({shipping:{topic:'shipping'},returns:{topic:'returns'}}),
 mail:t=>({[`mail-${t}-1`]:{subject:'Reunião para rever proposta',from_domain:'example.test',labels:[]},[`mail-${t}-2`]:{subject:'Fatura de setembro',from_domain:'example.test',labels:[]},[`mail-${t}-3`]:{subject:'Pedido de informação',from_domain:'example.test',labels:[]}}),
 source:()=>({'src-1':{topic:'automação',title:'Guia de automação para PME',url:'https://example.test/automacao',licensed:true},'src-2':{topic:'automação',title:'Tendências de IA no atendimento',url:'https://example.test/ia',licensed:false},'src-3':{topic:'ai',title:'AI in customer service',url:'https://example.test/ai',licensed:true}}),
 metric:()=>({'m-2026-09-1':{period:'2026-09',impressions:1200,clicks:85,leads:6},'m-2026-09-2':{period:'2026-09',impressions:900,clicks:40,leads:2}}),
 bank_line:t=>({[`bank-${t}-1`]:{amount_minor:123450,currency:'EUR',reference:'TRF FT-2026-0912'},[`bank-${t}-2`]:{amount_minor:9900,currency:'EUR',reference:'MB 77812'}}),
};
const systems={'ROLE-002':['slot'],'ROLE-003':['slot','mail'],'ROLE-004':['slot','property'],'ROLE-005':['order','faq'],'ROLE-006':['source','metric'],'ROLE-007':['bank_line'],'ROLE-008':['slot']};
for(const role of Object.values(ROLES)){
 await db.role.update({where:{id:role.id},data:{commercialState:'demo'}});
 const manifest=roleManifest(role);const raw=JSON.stringify(manifest);const sha=createHash('sha256').update(raw).digest('hex');const releaseId=`${role.packId}@${role.version}:${sha}`;
 await db.packRelease.upsert({where:{id:releaseId},create:{id:releaseId,packId:role.packId,version:role.version,sha,manifest,status:'demo'},update:{}});
 const n=role.id.slice(-3);
 for(const t of ['A','B']){
  const tenantId=`tenant-${t}`,deploymentId=`deployment-${t}-${n}`;
  await db.deployment.upsert({where:{id:deploymentId},create:{id:deploymentId,tenantId,roleId:role.id,packReleaseId:releaseId,state:'sandbox',config:{business_name:`Empresa Fictícia ${t}`,handoff_queue:`operator-${t}`,locale:'pt-PT'},limits:{dailyRuns:1000,alertAt:900}},update:{}});
  for(const toolId of ROLE_BINDINGS[role.id].tools)await db.toolGrant.upsert({where:{deploymentId_toolId:{deploymentId,toolId}},create:{tenantId,deploymentId,toolId,enabled:true,policy:{requiresApproval:role.tools[toolId].policy==='approval'}},update:{}});
  await db.channelBinding.upsert({where:{id:`channel-${t}-${n}`},create:{id:`channel-${t}-${n}`,tenantId,deploymentId,provider:'sandbox',inboxExternalId:`synthetic-${t}-${n}`},update:{}});
  // Slots are per role (slot-A-002-1…) so calendars of different roles never collide.
  for(const kind of systems[role.id])for(const [key,data] of Object.entries(fixtures[kind](kind==='slot'?`${t}-${n}`:t)))
   await db.sandboxRecord.upsert({where:{tenantId_kind_key:{tenantId,kind,key}},create:{id:randomUUID(),tenantId,kind,key,data},update:{}});
 }
}
console.log('Synthetic ROLE-002..008 deployments and sandbox systems prepared; existing data preserved');
await db.$disconnect();
