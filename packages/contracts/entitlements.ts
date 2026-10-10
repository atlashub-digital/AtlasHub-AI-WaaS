// Entitlement rules shared by the API, the inbound path, the worker and the tool gateway. Pure: callers load
// the rows (inside the tenant's RLS context) and resolve mission/product keys to role ids; nothing here reads
// the request text or the database. Keys: mission.<templateId> · product.<productId> · module.<module>.
import catalogue from './modules.json' with { type: 'json' };

export type ModuleKey = keyof typeof catalogue.modules;
export const MODULES = catalogue.modules as Record<ModuleKey, { label: string; roles: string[]; toolPrefixes: string[] }>;
export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

export type EntitlementRow = { key: string; status: string; validFrom: Date; validUntil: Date | null };
/** Grants that a resolved key gives on top of its name: the role a mission template or product sells. */
export type RoleByKey = Record<string, string | null | undefined>;

export const enforcing = (env: Record<string, string | undefined> = process.env) => env.ENTITLEMENTS_ENFORCE === '1';

export function isActive(row: EntitlementRow, now: Date) {
 return row.status === 'active' && row.validFrom.getTime() <= now.getTime() && (!row.validUntil || row.validUntil.getTime() > now.getTime());
}

export function activeKeys(rows: EntitlementRow[], now: Date) {
 return [...new Set(rows.filter(r => isActive(r, now)).map(r => r.key))].sort();
}

/** module.<m> turns a module on; any active mission.* or role product also means the tenant has Workforce. */
export function modulesOf(keys: string[], roleByKey: RoleByKey = {}): ModuleKey[] {
 const on = new Set<ModuleKey>();
 for (const key of keys) {
  if (key.startsWith('module.')) { const m = key.slice(7) as ModuleKey; if (m in MODULES) on.add(m); }
  else if (key.startsWith('mission.') || (key.startsWith('product.') && roleByKey[key])) on.add('workforce');
 }
 return MODULE_KEYS.filter(m => on.has(m));
}

/** A role runs when a module that lists it is on, or when a mission/product sold exactly that role. */
export function allowsRole(keys: string[], roleId: string, roleByKey: RoleByKey = {}) {
 for (const key of keys) {
  if (key.startsWith('module.')) { const m = MODULES[key.slice(7) as ModuleKey]; if (m?.roles.includes(roleId)) return true; }
  else if (roleByKey[key] === roleId) return true;
 }
 return false;
}

/** Module that owns a tool by prefix (ami.* → ami), or null when the tool is governed by its role only. */
export function moduleOfTool(toolId: string): ModuleKey | null {
 return MODULE_KEYS.find(m => MODULES[m].toolPrefixes.some(p => toolId.startsWith(p))) ?? null;
}

export function allowsTool(keys: string[], toolId: string) {
 const m = moduleOfTool(toolId);
 return m === null || keys.includes(`module.${m}`);
}
