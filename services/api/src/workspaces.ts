import { Controller, Get, Post, Req, Query, Body, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { identity, subject } from './auth.js';
import { withDb } from './context.js';
import { loadEntitlements } from '../../../packages/db/entitlements.js';
import { modulesOf } from '../../../packages/contracts/entitlements.js';

const scope = (who: { tenantId: string; sub: string }) => ({ tenantId: who.tenantId, userId: who.sub });
const input = z.object({
 tenant: z.string().min(1), slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
 name: z.string().min(1).max(120), summary: z.string().max(1000).default(''),
 status: z.enum(['planning','sandbox','active','paused','archived']).default('sandbox'),
 modules: z.array(z.enum(['workforce','ami','community','media'])).max(4).default([]),
 supervisorUserId: z.string().min(1).max(120).optional()
}).strict();
type ProjectRow = { id: string; tenantId: string; slug: string; name: string; summary: string; status: string; modules: string[]; supervisorUserId: string | null };
@Controller()
export class Workspaces {
 @Get('v1/projects')
 async projects(@Req() req: any, @Query('tenant') tenant?: string) {
  const who = await identity(req, tenant);
  return withDb(scope(who), async tx => {
   const rows = await tx.$queryRaw<ProjectRow[]>(Prisma.sql`SELECT id,"tenantId",slug,name,summary,status,modules,"supervisorUserId" FROM "Project" WHERE "tenantId"=${who.tenantId} ORDER BY "createdAt",id LIMIT 100`);
   const deployments = await tx.$queryRaw<{id:string;projectId:string}[]>(Prisma.sql`SELECT id,"projectId" FROM "Deployment" WHERE "tenantId"=${who.tenantId} AND "projectId" IS NOT NULL`);
   const ent = await loadEntitlements(tx, who.tenantId);
   const allowed = modulesOf(ent.keys, ent.roleByKey);
   return rows.map(({supervisorUserId, ...row}) => ({
    ...row, modules: row.modules.filter(m => allowed.includes(m as any)),
    supervisor: supervisorUserId ? {userId: supervisorUserId, displayName: 'Supervisor'} : null,
    deploymentIds: deployments.filter(d => d.projectId === row.id).map(d => d.id)
   }));
  });
 }
 @Post('v1/ops/projects')
 async createProject(@Req() req: any, @Body() body: unknown) {
  await subject(req);
  const parsed = input.safeParse(body);
  if (!parsed.success) throw new BadRequestException('Invalid request');
  const data = parsed.data;
  const who = await identity(req, data.tenant, true);
  if (!['atlas_owner','atlas_operator'].includes(who.role)) throw new ForbiddenException();
  return withDb(scope(who), async tx => {
   const ent = await loadEntitlements(tx, who.tenantId);
   const allowed = modulesOf(ent.keys, ent.roleByKey);
   if (data.modules.some(m => !allowed.includes(m))) throw new ForbiddenException('entitlement_required');
   if (data.supervisorUserId && !await tx.membership.findFirst({where:{tenantId:who.tenantId,userId:data.supervisorUserId,status:'active',role:{in:['tenant_admin','atlas_operator','atlas_owner']}}})) throw new BadRequestException('Invalid supervisor');
   const id = randomUUID();
   await tx.$executeRaw(Prisma.sql`INSERT INTO "Project" (id,"tenantId",slug,name,summary,status,modules,"supervisorUserId") VALUES (${id},${who.tenantId},${data.slug},${data.name},${data.summary},${data.status},${data.modules}::text[],${data.supervisorUserId ?? null})`);
   await tx.auditEvent.create({data:{tenantId:who.tenantId,actorId:who.sub,action:'project.create',objectId:id}});
   return {id,tenantId:who.tenantId,slug:data.slug,name:data.name,summary:data.summary,status:data.status,modules:data.modules,supervisor:data.supervisorUserId?{userId:data.supervisorUserId,displayName:'Supervisor'}:null,deploymentIds:[]};
  });
 }
 @Get('v1/expert')
 async expert(@Req() req:any,@Query('tenant') tenant?:string) {
  const who = await identity(req,tenant);
  // No Expert deployment exists yet. Membership and grants are real; availability must remain honest.
  return {tenantId:who.tenantId,enabled:false,deploymentId:null,state:null,supervisor:null,policies:[],recentPlans:[]};
 }
 @Get('v1/usage/summary')
 async usage(@Req() req:any,@Query('tenant') tenant?:string,@Query('from') from?:string,@Query('to') to?:string) {
  const who = await identity(req,tenant);
  const parsed=z.object({from:z.iso.datetime({offset:true}),to:z.iso.datetime({offset:true})}).safeParse({from,to});
  if(!parsed.success) throw new BadRequestException('Invalid interval');
  const start=new Date(parsed.data.from),end=new Date(parsed.data.to);
  if(end<=start || end.getTime()-start.getTime()>366*86400000) throw new BadRequestException('Invalid interval');
  return withDb(scope(who),async tx=>{
   const runs=await tx.taskRun.groupBy({by:['state'],where:{tenantId:who.tenantId,startedAt:{gte:start,lt:end}},_count:true});
   const metrics=await tx.usageRecord.groupBy({by:['metric','unit','currency'],where:{tenantId:who.tenantId,createdAt:{gte:start,lt:end}},_sum:{quantity:true,estimatedCost:true}});
   return {from:start.toISOString(),to:end.toISOString(),runs:Object.fromEntries(runs.map(r=>[r.state,r._count])),metrics:metrics.map(r=>({metric:r.metric,unit:r.unit,currency:r.currency,quantity:r._sum.quantity??0,estimatedCost:r._sum.estimatedCost?.toString()??'0'}))};
  });
 }
}
