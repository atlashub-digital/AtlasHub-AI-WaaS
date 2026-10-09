// Read-only probe of the Workspaces-facing contract against a local staging API (AUTH_MODE=staging).
// Prints one line per check: expected vs observed HTTP status. Synthetic users/tenants only; no writes.
// Usage: set -a; . ./.env.staging; set +a; node scripts/contract-probe.mjs [baseUrl]
import { SignJWT } from 'jose';

const base = process.argv[2] ?? 'http://127.0.0.1:4000';
if (process.env.AUTH_MODE !== 'staging') { console.error('Probe requires AUTH_MODE=staging (synthetic tokens)'); process.exit(2); }
const key = new TextEncoder().encode(process.env.STAGING_JWT_SECRET);
const token = sub => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(sub)
  .setIssuer(process.env.JWT_ISSUER).setAudience(process.env.JWT_AUDIENCE).setIssuedAt().setExpirationTime('5m').sign(key);

async function call(path, sub, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (sub) headers.authorization = `Bearer ${await token(sub)}`;
  const r = await fetch(base + path, { ...init, headers });
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

const checks = [
  ['no token → 401', '/v1/runs?tenant=tenant-A', null, 401],
  ['viewer-A reads own runs', '/v1/runs?tenant=tenant-A', 'viewer-A', 200],
  ['viewer-A reads tenant-B runs → 403', '/v1/runs?tenant=tenant-B', 'viewer-A', 403],
  ['admin-A reads tenant-B approvals → 403', '/v1/approvals?tenant=tenant-B', 'admin-A', 403],
  ['unknown user → 403', '/v1/usage?tenant=tenant-A', 'nobody-probe', 403],
  ['viewer-A usage', '/v1/usage?tenant=tenant-A', 'viewer-A', 200],
  ['viewer-A deployments of own tenant', '/v1/tenants/tenant-A/deployments', 'viewer-A', 200],
  ['viewer-A deployments of tenant-B → 403', '/v1/tenants/tenant-B/deployments', 'viewer-A', 403],
  ['tenant user cannot read ops metrics → 403', '/v1/ops/metrics?tenant=tenant-A', 'admin-A', 403],
  ['operator reads ops metrics', '/v1/ops/metrics?tenant=tenant-A', 'operator-A', 200],
  ['customer cannot read house CRM → 403', '/v1/ops/crm/leads', 'admin-A', 403],
  ['public catalogue', '/v1/public/catalog?locale=pt-BR', null, 200],
  ['GET /v1/me/memberships (feat branch)', '/v1/me/memberships', 'admin-A', 200],
  ['GET /v1/me/memberships unknown user → []', '/v1/me/memberships', 'nobody-probe', 200],
  ['GET /v1/me (proposed, not implemented) → 404', '/v1/me', 'admin-A', 404],
  ['GET /v1/entitlements (proposed, not implemented) → 404', '/v1/entitlements?tenant=tenant-A', 'admin-A', 404],
];

let fail = 0, skip = 0;
for (const [name, path, sub, expected] of checks) {
  const { status, body } = await call(path, sub);
  // /v1/me/memberships arrives with PR #7; on branches without it the route is absent (404) and is skipped.
  if (path.startsWith('/v1/me/memberships') && status === 404) { skip++; console.log(`SKIP 404 ${name} (route not on this branch)`); continue; }
  const ok = status === expected; if (!ok) fail++;
  const extra = path.startsWith('/v1/me/memberships') ? ` body=${JSON.stringify(body)}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'} ${String(status).padEnd(3)} (expected ${expected}) ${name}${extra}`);
}
console.log(`${checks.length - fail - skip}/${checks.length - skip} as expected${skip ? `, ${skip} skipped` : ''}`);
process.exit(fail ? 1 : 0);
