import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
if(process.env.AUTH_MODE!=='staging'||!process.env.DATABASE_URL?.includes('/waas_staging'))throw new Error('Seed only for isolated waas_staging database');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const names=['Rececionista Digital','Assistente Comercial','Secretária Administrativa','Consultor Imobiliário Digital','Assistente E-commerce','Assistente de Marketing','Assistente Financeiro Administrativo','Assistente de RH'];
for(let i=0;i<names.length;i++){const id=`ROLE-00${i+1}`;await db.role.upsert({where:{id},create:{id,slug:`role-${i+1}`,name:names[i],commercialState:i<3?'demo':'idea'},update:{}});}
const raw=readFileSync('packages/contracts/releases/PACK-001-0.1.0.json');const manifest=JSON.parse(raw);const sha=createHash('sha256').update(raw).digest('hex');
const releaseId=`PACK-001@${manifest.version}:${sha}`;await db.packRelease.upsert({where:{id:releaseId},create:{id:releaseId,packId:manifest.id,version:manifest.version,sha,manifest,status:manifest.status},update:{}});
for(const t of ['A','B']){
 const tenantId=`tenant-${t}`;await db.tenant.upsert({where:{id:tenantId},create:{id:tenantId,slug:`synthetic-${t.toLowerCase()}`,name:`Empresa Fictícia ${t}`},update:{}});
 for(const [userId,role] of [[`admin-${t}`,'tenant_admin'],[`viewer-${t}`,'tenant_user'],[`operator-${t}`,'atlas_operator']])await db.membership.upsert({where:{tenantId_userId:{tenantId,userId}},create:{tenantId,userId,role},update:{}});
 const deploymentId=`deployment-${t}`;await db.deployment.upsert({where:{id:deploymentId},create:{id:deploymentId,tenantId,roleId:'ROLE-001',packReleaseId:releaseId,state:'sandbox',config:{clinic_name:`Clínica Fictícia ${t}`,handoff_queue:`operator-${t}`},limits:{dailyRuns:100,alertAt:80}},update:{}});
 for(const toolId of ['agenda.get_appointment','agenda.find_slots','agenda.update_status','team.handoff'])await db.toolGrant.upsert({where:{deploymentId_toolId:{deploymentId,toolId}},create:{tenantId,deploymentId,toolId,enabled:true,policy:{rescheduleRequiresApproval:true}},update:{}});
 // Synthetic tenants get Workforce through an operator grant, so ENTITLEMENTS_ENFORCE=1 keeps the suites green.
 await db.commerceEntitlement.upsert({where:{tenantId_key_source_sourceId:{tenantId,key:'module.workforce',source:'grant',sourceId:'seed'}},create:{id:`ent-${t}-workforce`,tenantId,key:'module.workforce',source:'grant',sourceId:'seed'},update:{status:'active',validUntil:null}});
 await db.channelBinding.upsert({where:{id:`channel-${t}`},create:{id:`channel-${t}`,tenantId,deploymentId,provider:'sandbox',inboxExternalId:`synthetic-${t}`},update:{}});
 for(let i=1;i<=8;i++)await db.appointment.upsert({where:{id:`appointment-${t}-${i}`},create:{id:`appointment-${t}-${i}`,tenantId,conversationRef:`synthetic-${t}-${i}`,startsAt:new Date('2027-01-10T10:00:00Z'),consent:i!==5},update:{}});
 for(let i=1;i<=3;i++)await db.calendarSlot.upsert({where:{id:`slot-${t}-${i}`},create:{id:`slot-${t}-${i}`,tenantId,startsAt:new Date(`2027-01-1${i}T12:00:00Z`)},update:{}});
}
await db.$disconnect();console.log('Synthetic A/B fixtures prepared; existing data preserved');
