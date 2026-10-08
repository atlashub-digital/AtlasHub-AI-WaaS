import type { Prisma, PrismaClient } from '@prisma/client';

export type Scope = 'platform' | 'inbound' | 'resolve' | 'worker' | 'public_intake' | 'billing_webhook' | 'quote_accept' | 'billing';
export type DbContext = { tenantId?: string; userId?: string; scope?: Scope };

// Declares the RLS context for the current transaction only (set_config is_local=true).
export async function setContext(tx: Prisma.TransactionClient, ctx: DbContext) {
 await tx.$queryRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId ?? ''}, true), set_config('app.user_id', ${ctx.userId ?? ''}, true), set_config('app.scope', ${ctx.scope ?? ''}, true)`;
}

export function scoped<T>(db: PrismaClient, ctx: DbContext, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: { timeout?: number }): Promise<T> {
 return db.$transaction(async tx => { await setContext(tx, ctx); return fn(tx); }, options);
}

// Refuse to serve traffic over a connection that would silently bypass RLS.
export async function assertRuntimeRole(db: PrismaClient) {
 if (process.env.ALLOW_PRIVILEGED_DB === '1' && process.env.NODE_ENV !== 'production') return;
 const [row] = await db.$queryRaw<{ privileged: boolean }[]>`SELECT (r.rolsuper OR r.rolbypassrls OR EXISTS (SELECT 1 FROM pg_tables t WHERE t.schemaname = 'public' AND t.tablename = 'TaskRun' AND t.tableowner = current_user)) AS privileged FROM pg_roles r WHERE r.rolname = current_user`;
 if (!row || row.privileged) throw new Error('Database role bypasses RLS; connect as waas_runtime');
}
