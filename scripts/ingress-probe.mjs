// Black-box checks of the Core HTTPS ingress (infra/caddy/core-staging.caddy). Read-only: no request changes data.
// Usage: node scripts/ingress-probe.mjs https://<host> [--token <JWT of a tenant member>] [--foreign-tenant <id>]
const [base, ...rest] = process.argv.slice(2);
if (!base) { console.error('usage: ingress-probe.mjs <base-url> [--token JWT] [--foreign-tenant ID]'); process.exit(2); }
const arg = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
const token = arg('--token'), foreign = arg('--foreign-tenant');
const results = [];
async function check(name, path, { method = 'GET', auth = false, body, expect, header } = {}) {
 let status, headers;
 try {
  const r = await fetch(base + path, { method, redirect: 'manual', headers: { ...(auth && token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body });
  status = r.status; headers = r.headers; await r.arrayBuffer();
 } catch (e) { status = `error:${e.cause?.code ?? e.message}`; }
 const okStatus = Array.isArray(expect) ? expect.includes(status) : status === expect;
 const okHeader = !header || (headers && header(headers));
 results.push({ name, ok: okStatus && okHeader });
 console.log(`${okStatus && okHeader ? 'PASS' : 'FAIL'} ${name} → ${status}`);
}
await check('health reachable over TLS with HSTS and no Server header', '/health', { expect: 200, header: (h) => /max-age=\d+/.test(h.get('strict-transport-security') ?? '') && !h.get('server') && !h.get('x-powered-by') });
for (const [name, path, method] of [
 ['root is not exposed', '/', 'GET'], ['readiness detail is not exposed', '/ready', 'GET'], ['dotfiles are not exposed', '/.env', 'GET'],
 ['ops metrics are loopback-only', '/v1/ops/metrics?tenant=x', 'GET'], ['ops grant is loopback-only', '/v1/ops/entitlements', 'POST'],
 ['tenant creation is loopback-only', '/v1/tenants', 'POST'], ['membership admin is loopback-only', '/v1/tenants/x/memberships', 'POST'],
 ['deployment admin is loopback-only', '/v1/deployments', 'POST'], ['inbound webhooks are loopback-only', '/v1/inbound/sandbox', 'POST'],
 ['commerce/billing are not exposed', '/v1/public/catalog', 'GET'], ['assessments intake is not exposed', '/v1/assessments', 'POST'],
 ['retry is loopback-only', '/v1/ops/runs/x/retry', 'POST'], ['writes to read routes are refused', '/v1/runs', 'POST'],
]) await check(name, path, { method, expect: 404, body: method === 'POST' ? '{}' : undefined });
for (const path of ['/v1/me', '/v1/me/memberships', '/v1/entitlements', '/v1/runs', '/v1/approvals', '/v1/usage', '/v1/tenants/x/deployments'])
 await check(`exposed read ${path} needs a verified token`, path, { expect: 401 });
await check('approval decision needs a verified token', '/v1/approvals/x/decide', { method: 'POST', body: '{}', expect: 401 });
await check('oversized bodies are cut at the edge', '/v1/approvals/x/decide', { method: 'POST', body: JSON.stringify({ pad: 'x'.repeat(70 * 1024) }), expect: 413 });
if (token) {
 await check('member token reads its own identity', '/v1/me', { auth: true, expect: 200 });
 if (foreign) await check('member token cannot read a foreign tenant', `/v1/runs?tenant=${encodeURIComponent(foreign)}`, { auth: true, expect: 403 });
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} ingress checks passed`);
process.exit(failed ? 1 : 0);
