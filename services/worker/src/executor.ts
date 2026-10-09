import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma,PrismaClient } from '@prisma/client';
import { classify,toolInputs } from '../../../packages/contracts/policy.js';
import { scoped,setContext } from '../../../packages/db/context.js';
import { runRole,RolePolicyError } from './engine.js';
import { allowsRole,enforcing } from '../../../packages/contracts/entitlements.js';
import { loadEntitlements } from '../../../packages/db/entitlements.js';
export const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
// Worker resolves the run's tenant under the narrow 'worker' scope, then binds the transaction to that tenant.
export async function runTenant(runId:string){return (await scoped(db,{scope:'worker'},tx=>tx.taskRun.findUnique({where:{id:runId},select:{tenantId:true}})))?.tenantId;}
class PolicyError extends Error{}
async function event(tx:Prisma.TransactionClient,run:any,type:string,safePayload:Prisma.InputJsonValue={}){await tx.taskEvent.create({data:{tenantId:run.tenantId,runId:run.id,type,safePayload}});}
async function grant(tx:Prisma.TransactionClient,run:any,toolId:string,input:unknown){const schema=toolInputs[toolId];if(!schema||!schema.safeParse(input).success)throw new PolicyError('invalid_tool_input');const allowed=await tx.toolGrant.findFirst({where:{tenantId:run.tenantId,deploymentId:run.deploymentId,toolId,enabled:true}});if(!allowed)throw new PolicyError('tool_denied');await event(tx,run,'tool.authorized',{toolId});}
async function handoff(tx:Prisma.TransactionClient,run:any,reason:string){await grant(tx,run,'team.handoff',{reason});const existing=await tx.approval.findUnique({where:{runId:run.id}});const deployment=await tx.deployment.findUniqueOrThrow({where:{id:run.deploymentId}});const assigneeId=(deployment.config as {handoff_queue:string}).handoff_queue;
if(!existing)await tx.approval.create({data:{tenantId:run.tenantId,runId:run.id,requestedAction:reason,safeContext:{reason},assigneeId,expiresAt:new Date(Date.now()+3600000)}});else if(existing.state!=='pending')await tx.approval.update({where:{id:existing.id},data:{state:'pending',requestedAction:reason,safeContext:{reason},assigneeId,resolvedAt:null,expiresAt:new Date(Date.now()+3600000)}});await tx.taskRun.update({where:{id:run.id},data:{state:'awaiting_approval',result:{reason}}});await event(tx,run,'human.requested',{reason});}
export async function execute(runId:string){
 try{return await db.$transaction(async tx=>{
 await setContext(tx,{scope:'worker'});
 const existing=await tx.taskRun.findUnique({where:{id:runId}});if(!existing)return;
 await setContext(tx,{tenantId:existing.tenantId});
 // Deployment lock serializes pause, quota checks and every calendar mutation.
 await tx.$queryRaw`SELECT id FROM "Deployment" WHERE id=${existing.deploymentId} FOR UPDATE`;
 const run=await tx.taskRun.findUniqueOrThrow({where:{id:runId}});if(['completed','blocked','cancelled','suspended','dead_letter'].includes(run.state))return;
 const deployment=await tx.deployment.findFirst({where:{id:run.deploymentId,tenantId:run.tenantId}});const tenant=await tx.tenant.findUnique({where:{id:run.tenantId}});
 if(!deployment||tenant?.status!=='active'||!['sandbox','pilot','active'].includes(deployment.state)){await tx.taskRun.update({where:{id:run.id},data:{state:'suspended'}});await event(tx,run,'policy.paused');return;}
 // Entitlements are checked again at execution: they may have expired or been revoked since the run was queued.
 const ent=enforcing()?await loadEntitlements(tx,run.tenantId):undefined;
 if(ent&&!allowsRole(ent.keys,deployment.roleId,ent.roleByKey)){await tx.taskRun.update({where:{id:run.id},data:{state:'blocked',result:{reason:'entitlement_expired'}}});await event(tx,run,'policy.denied',{reason:'entitlement_expired'});return;}
 const limits=deployment.limits as {dailyRuns:number;alertAt:number};const today=new Date();today.setUTCHours(0,0,0,0);
 const used=await tx.usageRecord.count({where:{tenantId:run.tenantId,createdAt:{gte:today}}});
 if(used>=limits.dailyRuns){await tx.taskRun.update({where:{id:run.id},data:{state:'blocked',result:{reason:'quota'}}});await event(tx,run,'quota.exceeded');return;}
 // ROLE-002..008 run on the generic engine under the same lock, pause, tenant and quota checks.
 if(deployment.roleId!=='ROLE-001'){await runRole(tx,run,deployment,used,limits,ent?.keys);return;}
 const input=run.input as {conversation_ref:string;intent_text:string;slot_id?:string};
 // Calendar identifiers and consent are resolved from persisted channel context, never text.
 const appointment=await tx.appointment.findFirst({where:{tenantId:run.tenantId,conversationRef:input.conversation_ref}});
 if(!appointment||!appointment.consent){await tx.taskRun.update({where:{id:run.id},data:{state:'blocked',result:{reason:'consent_or_record_missing'},input:{conversation_ref:input.conversation_ref}}});await event(tx,run,'consent.blocked');return;}
 await grant(tx,run,'agenda.get_appointment',{appointment_id:appointment.id});
 const intent=classify(input.intent_text);
 if(intent==='clinical'||intent==='unknown'){await handoff(tx,run,intent);return;}
 if(intent==='reschedule'){
 await grant(tx,run,'agenda.find_slots',{appointment_id:appointment.id,preference:'available'});
 const slots=await tx.calendarSlot.findMany({where:{tenantId:run.tenantId,appointmentId:null,startsAt:{gt:new Date()}},orderBy:{startsAt:'asc'},take:2});
 if(!input.slot_id){if(!slots.length){await handoff(tx,run,'no_slots');return;}await tx.taskRun.update({where:{id:run.id},data:{state:'completed',result:{slots:slots.map(s=>({id:s.id,startsAt:s.startsAt.toISOString()}))},finishedAt:new Date(),input:{conversation_ref:input.conversation_ref}}});await event(tx,run,'calendar.slots',{slots:slots.map(s=>({id:s.id,startsAt:s.startsAt.toISOString()}))});return;}
 const approval=await tx.approval.findUnique({where:{runId:run.id}});
 if(!approval){await handoff(tx,run,'reschedule');return;}
 if(approval.state!=='approved'||approval.requestedAction!=='reschedule'){await tx.taskRun.update({where:{id:run.id},data:{state:'cancelled'}});return;}
 }
 const effectId=`${run.id}:agenda.update_status`;
 const previous=await tx.toolEffect.findUnique({where:{id:effectId}});if(previous)return;
 await grant(tx,run,'agenda.update_status',{appointment_id:appointment.id,status:intent==='confirm'?'confirmed':'rescheduled',version:appointment.version,...(input.slot_id?{slot_id:input.slot_id}:{})});
 let startsAt=appointment.startsAt;
 if(intent==='reschedule'){
 const slot=await tx.calendarSlot.findFirst({where:{id:input.slot_id,tenantId:run.tenantId,appointmentId:null,startsAt:{gt:new Date()}}});if(!slot){await handoff(tx,run,'conflict');return;}
 await tx.calendarSlot.updateMany({where:{tenantId:run.tenantId,appointmentId:appointment.id},data:{appointmentId:null}});
 const claimed=await tx.calendarSlot.updateMany({where:{id:slot.id,tenantId:run.tenantId,appointmentId:null},data:{appointmentId:appointment.id}});if(!claimed.count)throw new PolicyError('slot_conflict');startsAt=slot.startsAt;
 }
 const updated=await tx.appointment.updateMany({where:{id:appointment.id,tenantId:run.tenantId,version:appointment.version},data:{status:intent==='confirm'?'confirmed':'rescheduled',startsAt,version:{increment:1}}});if(!updated.count)throw new PolicyError('version_conflict');
 const result={status:intent==='confirm'?'confirmed':'rescheduled',appointment_id:appointment.id,starts_at:startsAt.toISOString()};
 await tx.toolEffect.create({data:{id:effectId,tenantId:run.tenantId,runId:run.id,toolId:'agenda.update_status',result}});
 await tx.taskRun.update({where:{id:run.id},data:{state:'completed',result,finishedAt:new Date(),costEstimate:0,input:{conversation_ref:input.conversation_ref}}});
 await tx.usageRecord.upsert({where:{runId:run.id},create:{tenantId:run.tenantId,runId:run.id,metric:'calendar_mutation',quantity:1,unit:'action',estimatedCost:0,currency:'BRL'},update:{}});
 await event(tx,run,'calendar.updated',result);
 if(used+1>=limits.alertAt)await tx.incident.create({data:{tenantId:run.tenantId,deploymentId:run.deploymentId,runId:run.id,severity:'info',reason:'quota_threshold'}});
 },{timeout:10000});}catch(error){
 if(error instanceof PolicyError||error instanceof RolePolicyError){const tenantId=await runTenant(runId);if(!tenantId)throw error;await scoped(db,{tenantId},async tx=>{const run=await tx.taskRun.findUniqueOrThrow({where:{id:runId}});await tx.taskRun.update({where:{id:runId},data:{state:'blocked',result:{reason:error.message}}});await event(tx,run,'policy.denied',{reason:error.message});});return;}
 throw error;
 }
}
