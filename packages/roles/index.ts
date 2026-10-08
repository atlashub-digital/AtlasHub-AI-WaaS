import type { RoleDefinition } from './types.js';
import { salesAssistant } from './r002-sales.js';
import { administrativeSecretary } from './r003-secretary.js';
import { realEstateConsultant } from './r004-real-estate.js';
import { ecommerceAssistant } from './r005-ecommerce.js';
import { marketingAssistant } from './r006-marketing.js';
import { financeAssistant } from './r007-finance.js';
import { hrAssistant } from './r008-hr.js';

// ROLE-002..008 run on the generic role engine. ROLE-001 keeps its dedicated Round 1 executor.
export const ROLES: Record<string, RoleDefinition> = Object.fromEntries([salesAssistant, administrativeSecretary, realEstateConsultant, ecommerceAssistant, marketingAssistant, financeAssistant, hrAssistant].map(r => [r.id, r]));

// Binding of every commercial role to its pack and the tools granted at provisioning time.
// Forbidden tools are never granted: the gateway denies them twice (policy and missing grant).
export const ROLE_BINDINGS: Record<string, { packId: string; tools: string[] }> = {
 'ROLE-001': { packId: 'PACK-001', tools: ['agenda.get_appointment', 'agenda.find_slots', 'agenda.update_status', 'team.handoff'] },
 ...Object.fromEntries(Object.values(ROLES).map(r => [r.id, { packId: r.packId, tools: Object.entries(r.tools).filter(([, t]) => t.policy !== 'forbidden').map(([id]) => id) }])),
};

export function roleManifest(r: RoleDefinition) {
 return { id: r.packId, slug: r.packSlug, version: r.version, role: r.id, intents: r.intents.map(i => i.id), tools: Object.fromEntries(Object.entries(r.tools).map(([id, t]) => [id, { policy: t.policy, effect: t.effect }])) };
}
export type { RoleDefinition } from './types.js';
