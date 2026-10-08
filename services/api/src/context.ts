import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
export const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
export const redisOptions={host:process.env.REDIS_HOST??'127.0.0.1',port:Number(process.env.REDIS_PORT??6379),maxRetriesPerRequest:null};
export const queue=new Queue('tasks',{connection:redisOptions});
export async function audit(tenantId:string,actorId:string,action:string,objectId:string){await db.auditEvent.create({data:{tenantId,actorId,action,objectId}});}
