import { z } from 'zod';
import type { Locale, ToolSpec } from './types.js';

export type L = Record<Locale, string>;
export const l = (ptPT: string, ptBR: string, en: string, es: string): L => ({ 'pt-PT': ptPT, 'pt-BR': ptBR, en, es });

// Instruction-like text is data, never authority: it routes to a human instead of reaching any tool.
export const INJECTION = /(ignor(a|e|ar) (as |all |las |todas )?(instru|previous|anterior)|system prompt|prompt do sistema|api[ _-]?key|segredo|secret|password|senha|contrase|tenant|bypass|jailbreak|developer mode|modo desenvolvedor)/i;

export const ref = z.string().min(1).max(120);
export const slotId = z.string().min(1).max(120);
export const locale = z.enum(['pt-PT', 'pt-BR', 'en', 'es']);

export const handoffTool: ToolSpec = {
 input: z.object({ reason: z.string().min(1).max(60) }).strict(),
 policy: 'auto',
 effect: false,
};

export const commonReplies: Record<string, L> = {
 handoff: l('Vou passar o seu pedido a um membro da equipa, que responderá em breve.', 'Vou passar seu pedido para alguém da equipe, que responderá em breve.', 'I am passing your request to a member of the team, who will reply shortly.', 'Paso su solicitud a una persona del equipo, que responderá en breve.'),
 forbidden: l('Esse pedido não pode ser executado por este serviço. Foi registado para a equipa.', 'Esse pedido não pode ser executado por este serviço. Foi registrado para a equipe.', 'This request cannot be carried out by this service. It has been logged for the team.', 'Esta solicitud no puede ser ejecutada por este servicio. Se ha registrado para el equipo.'),
 consent: l('Antes de continuar, precisamos do seu consentimento para tratar estes dados.', 'Antes de continuar, precisamos do seu consentimento para tratar estes dados.', 'Before we continue, we need your consent to process this data.', 'Antes de continuar, necesitamos su consentimiento para tratar estos datos.'),
 not_found: l('Não encontrámos esse registo. Verifique os dados ou fale com a equipa.', 'Não encontramos esse registro. Verifique os dados ou fale com a equipe.', 'We could not find that record. Please check the details or contact the team.', 'No encontramos ese registro. Revise los datos o contacte con el equipo.'),
 rejected: l('A equipa não aprovou esta ação. Entraremos em contacto.', 'A equipe não aprovou esta ação. Entraremos em contato.', 'The team did not approve this action. We will be in touch.', 'El equipo no aprobó esta acción. Nos pondremos en contacto.'),
};

export function fill(template: string, vars: Record<string, string | number> = {}) {
 return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
}

// Score is deterministic and explainable: no protected attributes, only declared business fit.
export function leadScore(d: { size?: string; budget?: string; timeline?: string }) {
 const size = { micro: 10, small: 25, medium: 35, large: 40 }[d.size ?? ''] ?? 0;
 const budget = { none: 0, low: 10, medium: 25, high: 35 }[d.budget ?? ''] ?? 0;
 const timeline = { now: 25, quarter: 15, later: 5 }[d.timeline ?? ''] ?? 0;
 return size + budget + timeline;
}
