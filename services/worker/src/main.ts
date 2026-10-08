import { PrismaPg } from '@prisma/adapter-pg';
import { Worker,Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { execute } from './executor.js';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const connection={host:process.env.REDIS_HOST??'127.0.0.1',port:Number(process.env.REDIS_PORT??6379),maxRetriesPerRequest:null};
const worker=new Worker('tasks',async job=>{await db.taskRun.update({where:{id:job.data.runId},data:{attempts:{increment:1}}});await execute(job.data.runId);},{connection,concurrency:2});
worker.on('failed',async(job)=>{if(!job||(job.attemptsMade<(job.opts.attempts??1)))return;const run=await db.taskRun.findUnique({where:{id:job.data.runId}});if(!run)return;await db.$transaction([db.taskRun.update({where:{id:run.id},data:{state:'dead_letter'}}),db.incident.create({data:{tenantId:run.tenantId,deploymentId:run.deploymentId,runId:run.id,severity:'high',reason:'executor_unavailable'}})]);});
worker.on('error',()=>console.error(JSON.stringify({event:'worker.error',reason:'dependency_unavailable'})));
// Transactional runs are an outbox: recover queue publication gaps after restarts.
const queue=new Queue('tasks',{connection});
const timer=setInterval(async()=>{try{for(const run of await db.taskRun.findMany({where:{state:'queued'},take:100})){const approval=await db.approval.findUnique({where:{runId:run.id}});const jobId=approval?.state==='approved'?`approval-${approval.id}`:run.id;await queue.add('execute',{runId:run.id},{jobId,attempts:3,backoff:{type:'exponential',delay:200}});}}catch{console.error(JSON.stringify({event:'outbox.retry'}));}},5000);
async function stop(){clearInterval(timer);await worker.close();await queue.close();await db.$disconnect();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
