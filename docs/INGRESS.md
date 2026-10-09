# Ingress HTTPS do Core (staging) — proposta, não aplicada

Autorizado em 09/10/2026: planeamento, validação e preparação. **Não autorizado:** alterar o Caddy partilhado da VPS.

## Peças
- `infra/caddy/core-staging.caddy`: bloco de site isolado, importado no Caddyfile partilhado (uma linha `import`). Hostname e upstream por variáveis de ambiente (`CORE_STAGING_HOST`, `CORE_UPSTREAM`). O valor real vive no repositório privado de operações.
- `PUBLIC_INGRESS=1` na API: recusa arrancar com `AUTH_MODE=staging` (HS256 partilhado) e exige `JWT_JWKS_URL` (Supabase). Também limita leituras.
- `TRUST_PROXY=1` na API: o rate limit usa o IP do cliente que o Caddy acrescenta ao `X-Forwarded-For` (última entrada), em vez do IP do proxy.
- `scripts/ingress-probe.mjs`: verificação de caixa preta, só de leitura.

## Superfície exposta (allowlist; o resto é 404 no edge)
| Método | Caminho | Proteção no Core |
|---|---|---|
| GET | `/health` | — (sem detalhe de dependências) |
| GET | `/v1/me`, `/v1/me/memberships` | JWT |
| GET | `/v1/entitlements`, `/v1/runs`, `/v1/runs/{id}`, `/v1/approvals`, `/v1/usage`, `/v1/roles` | JWT + membership + RLS |
| GET | `/v1/tenants/{id}/deployments` | JWT + membership + RLS |
| POST | `/v1/approvals/{id}/decide` | JWT + papel de escrita + RLS (autentica antes de validar o corpo) |

**Fica só em loopback** (operadores por túnel SSH): `/v1/ops/*`, `POST /v1/tenants*`, `/v1/deployments*`, `/v1/inbound/*`, assessments, comércio e faturação, `/ready`.

## Limites
- Corpo máximo de 64 KB no edge (413).
- POST: 120/min por IP de cliente; leituras: 600/min por IP de cliente (só com `PUBLIC_INGRESS=1`). Limitação conhecida: o BFF do Workspaces sai por IPs da Vercel partilhados entre utilizadores; para o piloto chega, mas a medida seguinte é limitar por `sub` verificado.
- Cabeçalhos: HSTS, `nosniff`, `no-referrer`, `DENY`, sem `Server`/`X-Powered-By`. Logs JSON com rotação.

## Evidência (local, 09/10)
Caddy v2.10.2 (`caddy validate` válido) com TLS interno à frente da API real (Postgres 16 + Redis, `waas_runtime`, `ENTITLEMENTS_ENFORCE=1`): `ingress-probe` **25/25**, incluindo 200 com o token de um membro e 403 para outro tenant. Arranque com `AUTH_MODE=staging` + `PUBLIC_INGRESS=1` recusado. Rate limit por IP de cliente através do proxy: o cliente que excede recebe 429 e outro cliente não é afetado. Todas as suites passam (unit 19, e2e 14, db-security 2, rls 6, roles 11, commerce 8, entitlements 7).
