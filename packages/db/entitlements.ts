import type { Prisma } from '@prisma/client';
import { activeKeys, type RoleByKey } from '../contracts/entitlements.js';

// Reads the tenant's entitlements inside an RLS-bound transaction (tenant_isolation) and resolves which role each
// mission template or product sells. Catalogue tables are readable by waas_runtime in any scope.
export async function loadEntitlements(tx: Prisma.TransactionClient, tenantId: string, now = new Date()) {
 const rows = await tx.commerceEntitlement.findMany({ where: { tenantId }, orderBy: [{ key: 'asc' }, { validFrom: 'asc' }] });
 const keys = activeKeys(rows, now);
 const templates = keys.filter(k => k.startsWith('mission.')).map(k => k.slice(8));
 const products = keys.filter(k => k.startsWith('product.')).map(k => k.slice(8));
 const roleByKey: RoleByKey = {};
 if (templates.length) for (const t of await tx.catalogMissionTemplate.findMany({ where: { id: { in: templates } }, select: { id: true, roleId: true } })) roleByKey[`mission.${t.id}`] = t.roleId;
 if (products.length) for (const p of await tx.catalogProduct.findMany({ where: { id: { in: products } }, select: { id: true, roleId: true } })) roleByKey[`product.${p.id}`] = p.roleId;
 return { rows, keys, roleByKey };
}
