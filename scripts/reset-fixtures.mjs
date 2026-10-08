import {PrismaClient} from '@prisma/client';import {PrismaPg} from '@prisma/adapter-pg';
if(process.env.AUTH_MODE!=='staging'||!process.env.DATABASE_URL?.includes('/waas_staging')||process.env.ALLOW_STAGING_RESET!=='1')throw new Error('Explicit ALLOW_STAGING_RESET=1 required on isolated waas_staging');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
for(const t of ['A','B']){
 const tenantId=`tenant-${t}`;const tenant=await db.tenant.findUniqueOrThrow({where:{id:tenantId}});if(tenant.slug!==`synthetic-${t.toLowerCase()}`)throw new Error('Not a synthetic tenant');
 await db.$transaction(async tx=>{for(const table of ['toolEffect','taskEvent','usageRecord','approval','incident','auditEvent','taskRun'])await tx[table].deleteMany({where:{tenantId}});await tx.calendarSlot.updateMany({where:{tenantId},data:{appointmentId:null}});for(let i=1;i<=3;i++)await tx.calendarSlot.update({where:{id:`slot-${t}-${i}`},data:{startsAt:new Date(`2027-01-1${i}T12:00:00Z`)}});await tx.appointment.updateMany({where:{tenantId},data:{status:'scheduled',version:0,startsAt:new Date('2027-01-10T10:00:00Z')}});await tx.deployment.updateMany({where:{tenantId},data:{state:'sandbox',limits:{dailyRuns:100,alertAt:80}}});await tx.toolGrant.updateMany({where:{tenantId},data:{enabled:true}});});
}
await db.$disconnect();console.log('Only synthetic A/B test fixtures reset');
