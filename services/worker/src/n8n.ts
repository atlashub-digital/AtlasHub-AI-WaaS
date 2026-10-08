import {createHmac} from 'node:crypto';import {z} from 'zod';import {toolInputs} from '../../../packages/contracts/policy.js';
const paths:Record<string,string>={'agenda.get_appointment':'agenda-get','agenda.find_slots':'agenda-slots','agenda.update_status':'agenda-update','team.handoff':'handoff'};
const outputs:Record<string,z.ZodType>={
 'agenda.get_appointment':z.object({patient_first_name:z.string(),starts_at:z.string().datetime(),professional:z.string(),status:z.string()}).strict(),
 'agenda.find_slots':z.object({slots:z.array(z.string().datetime()).max(20)}).strict(),
 'agenda.update_status':z.object({ok:z.literal(true)}).strict(),
 'team.handoff':z.object({task_id:z.string()}).strict(),
};
// Integration boundary only. Activation requires audited workflow idempotency,
// verified channel identity, calendar isolation and credentials on the target VPS.
export async function callN8n(config:{url:string;secret:string;staging?:boolean;timeoutMs?:number},context:{tenantId:string;deploymentId:string;runId:string},toolId:string,input:unknown){
 const url=new URL(config.url);if(url.protocol!=='https:'&&!(config.staging&&url.hostname==='127.0.0.1'))throw new Error('TLS required');
 if(!paths[toolId]||!toolInputs[toolId]?.safeParse(input).success)throw new Error('Invalid tool input');if(config.secret.length<32)throw new Error('Invalid service signing key');
 const body=JSON.stringify({identity:context,tool:toolId,input,timestamp:new Date().toISOString()});
 const response=await fetch(new URL(`/webhook/pack-001/${paths[toolId]}`,url),{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':`${context.runId}:${toolId}`,'X-Atlas-Signature':createHmac('sha256',config.secret).update(body).digest('hex')},body,signal:AbortSignal.timeout(config.timeoutMs??3000),redirect:'error'});
 if(!response.ok)throw new Error('Connector unavailable');return outputs[toolId].parse(await response.json());
}
// Generic role tools: POST {N8N_BASE_URL}/webhook/<pack-slug>/<tool-id>, signed and idempotent per run.
// Enabled per deployment (config.n8n_tools); inputs are already schema-validated by the gateway.
export async function callN8nTool(context:{tenantId:string;deploymentId:string;runId:string},packSlug:string,toolId:string,input:unknown){
 const base=process.env.N8N_BASE_URL,secret=process.env.N8N_SIGNING_SECRET??'';
 if(!base||secret.length<32)throw new Error('tool_unavailable');
 const url=new URL(`/webhook/${packSlug}/${toolId.replace('.','-')}`,base);if(url.protocol!=='https:')throw new Error('tool_unavailable');
 const body=JSON.stringify({identity:context,tool:toolId,input,timestamp:new Date().toISOString()});
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':`${context.runId}:${toolId}`,'X-Atlas-Signature':createHmac('sha256',secret).update(body).digest('hex')},body,signal:AbortSignal.timeout(Number(process.env.N8N_TIMEOUT_MS??5000)),redirect:'error'});
 if(!response.ok)throw new Error('tool_failed');
 return z.record(z.string(),z.unknown()).parse(await response.json()) as Record<string,any>;
}
