import { z } from 'zod';
export const inbound = z.object({event_id:z.string().min(1).max(120),channel_binding_id:z.string().min(1).max(120),timestamp:z.string().datetime(),payload:z.object({conversation_ref:z.string().min(1).max(120),intent_text:z.string().max(2000),slot_id:z.string().max(120).optional()}).strict()}).strict();
export const deploymentInput = z.object({tenantId:z.string(),roleId:z.string(),packReleaseId:z.string(),config:z.object({clinic_name:z.string().min(1),handoff_queue:z.string().min(1)}).strict(),limits:z.object({dailyRuns:z.number().int().min(1).max(10000),alertAt:z.number().int().min(1).max(10000)})}).strict();
export const toolInputs:Record<string,z.ZodType>={
 'agenda.get_appointment':z.object({appointment_id:z.string()}).strict(),
 'agenda.find_slots':z.object({appointment_id:z.string(),preference:z.string()}).strict(),
 'agenda.update_status':z.object({appointment_id:z.string(),status:z.enum(['confirmed','rescheduled']),slot_id:z.string().optional(),version:z.number().int().nonnegative()}).strict(),
 'team.handoff':z.object({reason:z.enum(['clinical','unknown','no_slots','reschedule','conflict','unavailable'])}).strict(),
};
export const transitions:Record<string,string[]>={draft:['sandbox','terminated'],sandbox:['acceptance','paused','terminated'],acceptance:['sandbox','pilot','paused','terminated'],pilot:['active','paused','suspended','terminated'],active:['paused','suspended','terminated'],paused:['sandbox','pilot','active','terminated'],suspended:['paused','terminated'],terminated:[]};
export function classify(text:string):'clinical'|'confirm'|'reschedule'|'unknown' {
 if (/sintom|dor|urg[eê]n|medica|diagn[oó]st|cl[ií]nic/i.test(text)) return 'clinical';
 if (/ignora|ignore|secret|segredo|tenant|system|prompt/i.test(text)) return 'unknown';
 if (/remarc|reagend/i.test(text)) return 'reschedule';
 if (/^\s*(confirmo|confirmar|sim|confirmado)[.!\s]*$/i.test(text)) return 'confirm';
 return 'unknown';
}
