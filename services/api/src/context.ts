import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { scoped, type DbContext } from '../../../packages/db/context.js';
export const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
export const redisOptions={host:process.env.REDIS_HOST??'127.0.0.1',port:Number(process.env.REDIS_PORT??6379),maxRetriesPerRequest:null};
export const queue=new Queue('tasks',{connection:redisOptions});
export const billingQueue=new Queue('billing',{connection:redisOptions});
export const withDb=<T>(ctx:DbContext,fn:(tx:Prisma.TransactionClient)=>Promise<T>)=>scoped(db,ctx,fn);
export async function audit(tx:Prisma.TransactionClient,tenantId:string,actorId:string,action:string,objectId:string){await tx.auditEvent.create({data:{tenantId,actorId,action,objectId}});}
