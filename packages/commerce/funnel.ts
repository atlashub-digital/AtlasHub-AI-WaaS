import { createHash } from 'node:crypto';
import { z } from 'zod';
import { COMMERCE_LOCALES, CURRENCIES } from './i18n.js';

// Amounts are BIGINT minor units in the database; they stay far below 2^53, so API responses use numbers.
export const toNumber = (v: bigint | number | null | undefined) => v === null || v === undefined ? null : Number(v);

const locale = z.enum(COMMERCE_LOCALES);
const roleId = z.enum(['ROLE-001', 'ROLE-002', 'ROLE-003', 'ROLE-004', 'ROLE-005', 'ROLE-006', 'ROLE-007', 'ROLE-008']);
const utm = z.object({ source: z.string().max(80), medium: z.string().max(80), campaign: z.string().max(120), term: z.string().max(120), content: z.string().max(120) }).partial().strict();

export const simulationInput = z.object({
 roleId, locale: locale.default('pt-BR'), currency: z.enum(CURRENCIES).default('BRL'), templateId: z.string().max(80).optional(),
 volumePerMonth: z.number().int().min(1).max(1_000_000), minutesPerTask: z.number().min(0.5).max(240), automatablePct: z.number().min(0).max(100),
 hourlyCostMinor: z.number().int().min(0).max(10_000_000).optional(),
}).strict();

// Explainable hypothesis only: hours the team no longer spends, and their cost if the visitor gives one.
export function simulate(i: z.infer<typeof simulationInput>) {
 const hoursSaved = Math.round(i.volumePerMonth * i.minutesPerTask * (i.automatablePct / 100) / 60);
 const teamCostSavedMinor = i.hourlyCostMinor !== undefined ? Math.round(hoursSaved * i.hourlyCostMinor) : null;
 return { hoursSaved, teamCostSavedMinor };
}

export const leadInput = z.object({
 fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), phone: z.string().max(30).optional(),
 company: z.string().trim().min(1).max(160).optional(), companyDomain: z.string().max(120).optional(), country: z.string().length(2).optional(),
 sizeBand: z.enum(['micro', 'small', 'medium', 'large']).optional(), interestRoles: z.array(roleId).max(8).default([]),
 locale: locale.default('pt-BR'), source: z.enum(['site', 'simulator', 'clara']).default('site'), utm: utm.default({}),
 consent: z.literal(true), consentTextVersion: z.string().max(40),
 conciergeSessionId: z.string().max(80).optional(), simulation: simulationInput.partial().optional(),
 website: z.string().max(0).optional(), // honeypot: real visitors never fill it
}).strict();

export const trialInput = leadInput.extend({ templateId: z.string().min(1).max(80), days: z.union([z.literal(3), z.literal(7)]) }).strict();

export const normEmail = (e: string) => e.trim().toLowerCase();
// E.164 without external libraries: keep an explicit +country prefix, or infer it from the locale.
export function normPhone(raw: string | undefined, loc: string) {
 if (!raw) return null;
 const digits = raw.replace(/[^\d+]/g, '');
 if (digits.startsWith('+')) return /^\+\d{8,15}$/.test(digits) ? digits : null;
 const cc = loc === 'pt-BR' ? '55' : loc === 'pt-PT' ? '351' : loc === 'es' ? '34' : loc === 'fr' ? '33' : null;
 const local = digits.replace(/^0+/, '');
 return cc && /^\d{8,12}$/.test(local) ? `+${cc}${local}` : null;
}
export const suppressionHash = (kind: 'email' | 'phone' | 'domain', value: string) => createHash('sha256').update(`${kind}:${value.toLowerCase()}`).digest('hex');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

// Deterministic, explainable lead score from declared business fit (no protected attributes).
export function fitScore(i: { sizeBand?: string; interestRoles: string[]; simulation?: { volumePerMonth?: number } }) {
 const size = { micro: 10, small: 25, medium: 35, large: 40 }[i.sizeBand ?? ''] ?? 0;
 const volume = (i.simulation?.volumePerMonth ?? 0) >= 1000 ? 30 : (i.simulation?.volumePerMonth ?? 0) >= 200 ? 20 : (i.simulation?.volumePerMonth ?? 0) > 0 ? 10 : 0;
 return Math.min(100, size + volume + Math.min(30, i.interestRoles.length * 10));
}

export const STAGES = ['new', 'contacted', 'qualified', 'simulation', 'trial_requested', 'trial_active', 'proposal_sent', 'negotiation', 'won', 'lost', 'nurture'] as const;
// Allowed manual moves; automatic moves (simulation, trial, proposal, won) are made by the platform itself.
export const STAGE_MOVES: Record<string, string[]> = {
 new: ['contacted', 'qualified', 'lost', 'nurture'], contacted: ['qualified', 'lost', 'nurture'], qualified: ['negotiation', 'lost', 'nurture'],
 simulation: ['contacted', 'qualified', 'lost', 'nurture'], trial_requested: ['lost'], trial_active: ['negotiation', 'lost'],
 proposal_sent: ['negotiation', 'lost'], negotiation: ['lost'], won: [], lost: ['nurture'], nurture: ['contacted', 'lost'],
};
