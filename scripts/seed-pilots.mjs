// Synthetic pilot tenants for the controlled Workspaces pilot. Generic names only: the mapping to real
// organisations lives in the private ops repository, never here. No people, no customer data.
import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';
if(process.env.AUTH_MODE!=='staging'||!process.env.DATABASE_URL?.includes('/waas_staging'))throw new Error('Seed only for isolated waas_staging database');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const PILOTS=[
 {id:'pilot-a-sandbox',name:'Cliente-piloto A (sandbox)',modules:['workforce','ami']},
 {id:'pilot-b-sandbox',name:'Cliente-piloto B (sandbox)',modules:['workforce','media']},
 {id:'pilot-c-sandbox',name:'Cliente-piloto C (sandbox)',modules:['workforce','community']},
 {id:'atlas-synthetic-qa',name:'AtlasHub QA (sintético)',modules:['workforce']},
];
for(const p of PILOTS){
 await db.tenant.upsert({where:{id:p.id},create:{id:p.id,slug:p.id,name:p.name},update:{}});
 for(const [userId,role] of [[`${p.id}:admin`,'tenant_admin'],[`${p.id}:viewer`,'tenant_user']])await db.membership.upsert({where:{tenantId_userId:{tenantId:p.id,userId}},create:{tenantId:p.id,userId,role},update:{}});
 await db.project.upsert({where:{tenantId_slug:{tenantId:p.id,slug:'synthetic-pilot'}},create:{id:'project-'+p.id,tenantId:p.id,slug:'synthetic-pilot',name:'Projeto sintético',summary:'Sem dados reais ou acessos externos',status:'sandbox',modules:p.modules,supervisorUserId:p.id+':admin'},update:{}});
 for(const m of p.modules)await db.commerceEntitlement.upsert({where:{tenantId_key_source_sourceId:{tenantId:p.id,key:`module.${m}`,source:'grant',sourceId:'seed'}},create:{id:`ent-${p.id}-${m}`,tenantId:p.id,key:`module.${m}`,source:'grant',sourceId:'seed'},update:{status:'active',validUntil:null}});
}
await db.$disconnect();console.log(`Synthetic pilot tenants prepared: ${PILOTS.length}`);
