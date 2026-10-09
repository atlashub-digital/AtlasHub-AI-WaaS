# 01 — Auditoria do estado real do Core

Verificado em 2026-10-09 sobre `main` @ `50374f2` + `feat/me-memberships` (rebase limpo). Tudo o que se segue é reproduzível com os comandos indicados.

## 1. Ambiente da verificação

| Item | Valor | Nota |
|---|---|---|
| Postgres | **16** local (a CI usa 17.6) | O Docker Hub está bloqueado nesta sessão, por isso não usei a imagem da CI. As 6 migrations aplicaram sem erro. |
| Redis | 7 local | — |
| API e worker | `DATABASE_URL=$APP_DATABASE_URL` → role `waas_runtime` | `assertRuntimeRole` recusa arrancar com uma role privilegiada |
| Auth | `AUTH_MODE=staging` (HS256, segredo local gerado) | Utilizadores e tenants sintéticos A/B |

Sequência: `node scripts/init-staging.mjs` → `db:generate` → `db:deploy` → `runtime-role.mjs` → `db:seed` → `build` → `seed-roles.mjs` → `seed-commerce.mjs`, ou seja, a mesma de `scripts/staging.sh` sem o Compose.

## 2. Testes (evidência)

| Suite | Resultado |
|---|---|
| `npm run check` (tsc + unitários) | `# pass 14 # fail 0` |
| `tests/e2e.mjs` (ROLE-001) | `# pass 14 # fail 0` |
| `tests/database-security.mjs` | `# pass 2 # fail 0` |
| `tests/runtime-rls.mjs` | `# pass 6 # fail 0` |
| `tests/roles.e2e.mjs` (ROLE-002..008 + me/memberships) | `# pass 11 # fail 0` |
| `tests/commerce.e2e.mjs` | `# pass 8 # fail 0` |
| `scripts/readiness-recovery.mjs`, `scripts/backup-restore.sh` | **não executados** (dependem de containers Docker); correm na CI |

## 3. RLS e papéis (evidência na base)

- Todas as tabelas de negócio em `public` têm `relrowsecurity = true`. A única sem RLS é `waas_migrations`, privada por grants.
- Políticas: `tenant_isolation` e `platform_operator` em todas as tabelas com `tenantId`. Há também `tenant_self` (Tenant), `own_memberships` (Membership), scopes só de leitura `inbound`, `resolve` e `worker`, `catalogue_read` (Role, PackRelease) e `intake` (Assessment).
- Contexto por transação: `set_config('app.tenant_id'|'app.user_id'|'app.scope', …, true)` em `packages/db/context.ts`.
- Seeds sintéticos: 8 `Role` (ROLE-001..008, `commercialState = demo`), 8 `PackRelease` (PACK-001..008), memberships `tenant_user`, `tenant_admin`, `atlas_operator` e `atlas_owner`.

`contract-probe.mjs` contra a API local:

```text
PASS 401 no token → 401
PASS 200 viewer-A reads own runs
PASS 403 viewer-A reads tenant-B runs → 403
PASS 403 admin-A reads tenant-B approvals → 403
PASS 403 unknown user → 403
PASS 200 viewer-A usage
PASS 200 viewer-A deployments of own tenant
PASS 403 viewer-A deployments of tenant-B → 403
PASS 403 tenant user cannot read ops metrics → 403
PASS 200 operator reads ops metrics
PASS 403 customer cannot read house CRM → 403
PASS 200 public catalogue
PASS 200 GET /v1/me/memberships (feat branch) body=[{"tenantId":"tenant-A","role":"tenant_admin","name":"Empresa Fictícia A"}]
PASS 200 GET /v1/me/memberships unknown user → [] body=[]
PASS 404 GET /v1/me (proposed, not implemented) → 404
PASS 404 GET /v1/entitlements (proposed, not implemented) → 404
16/16 as expected
```

## 4. Contrato OpenAPI vs rotas implementadas

O script compara os decoradores `@Get/@Post` em `services/api/src/*.ts` com `packages/contracts/openapi.json`:

| | Quantidade |
|---|---|
| Rotas implementadas | **39** |
| Rotas em `openapi.json` 0.1.0 | **19** |
| Documentadas e não implementadas | 0 |
| **Implementadas e não documentadas** | **20** |
| Operações com schema de resposta | **0 de 19** (só códigos e descrições) |

Rotas não documentadas: `GET /v1/me/memberships` (só na branch), `GET /v1/public/catalog`, `POST /v1/public/simulate`, `GET /v1/public/consent-text`, `POST /v1/public/leads`, `POST /v1/public/trials`, `POST /v1/public/concierge/sessions`, `POST /v1/public/quotes/accept`, `GET /v1/ops/crm/leads`, `POST /v1/ops/crm/leads/:id/stage`, `POST /v1/ops/crm/leads/:id/suppress`, `POST /v1/ops/crm/imports`, `POST /v1/ops/crm/imports/:id/commit`, `POST /v1/ops/trials/:id/approve`, `POST /v1/ops/trials/:id/decline`, `POST /v1/ops/quotes`, `POST /v1/ops/quotes/:id/send`, `GET /v1/billing/invoices`, `GET /v1/billing/invoices/:id/document`, `POST /v1/webhooks/payments/:provider`.

`api-types.ts` é reproduzível: o `openapi-typescript` 7.9.1 regenera o ficheiro commitado byte a byte.

## 5. Branches e PRs

| Repositório | Ref | Estado verificado | Ação |
|---|---|---|---|
| AtlasHub-AI-WaaS | `feat/me-memberships` (`d7d8516`, 08/10) | 1 commit à frente; base `d917e73`; `main` só avançou com docs; rebase sem conflitos; suites verdes | Commit `6f19fb9` acrescenta o endpoint ao contrato (0.2.0) → **PR #7 (draft)** |
| AtlasHub-AI-WaaS | PR #6 (`feat/round-1-staging`) | fechado; head `71f8b74` já é antecessor de `main` | nada |
| atlas-agent-packs | `feat/catalog-tools` (`460521b`, 0.3.1) | 0 commits atrás de `main`; `validate` 8/8, `test` 10/10, `build` ok; 8 blocos `tools` (35 `auto`, 8 `approval`) | **PR #2 (draft)** |
| atlas-agent-packs | PR #1 | já em `main` | nada |
| AtlasHub-Workspaces | `main` (`cc88320`) | **só README** (commit inicial) | shell iniciado por Claude em `feat/workspaces-shell` |

## 6. Inventário funcional do Core (existente)

| Domínio | Modelos | Endpoints | Nota |
|---|---|---|---|
| Identidade/tenancy | Tenant, Membership | `POST /v1/tenants`, `POST /v1/tenants/{id}/memberships`, *(PR #7)* `GET /v1/me/memberships` | Sem perfis; o `sub` do JWT é a identidade |
| Catálogo técnico | Role, PackRelease | `GET /v1/roles` | Vem do `atlas-agent-packs` (releases em `packages/contracts/releases`) |
| Catálogo comercial | catalog_mission_template(_i18n), catalog_product(_i18n), catalog_price | `GET /v1/public/catalog` | 8 missões × 5 línguas; só preços `active` |
| Deployments | Deployment, ToolGrant, ChannelBinding, IntegrationConnection | `GET /v1/tenants/{id}/deployments`, `POST /v1/deployments`, `…/transition`, `…/pause` | `pilot`/`active` bloqueados até homologação |
| Execução | TaskRun, TaskEvent, Incident | `POST /v1/inbound/{provider}`, `GET /v1/runs`, `GET /v1/runs/{id}`, `POST /v1/ops/runs/{id}/retry`, `GET /v1/ops/incidents` | Input bruto nunca devolvido; DLQ + retry de operador |
| Aprovações | Approval | `GET /v1/approvals`, `POST /v1/approvals/{id}/decide` | Expiram em 1 h; o estado fica `pending` até à decisão (não há limpeza automática) |
| Uso | UsageRecord | `GET /v1/usage`, `GET /v1/ops/metrics` | Só lista (`take 100`) e groupBy de runs |
| Auditoria | AuditEvent | **nenhum endpoint de leitura** | Escrito em criação de tenant, membership, decisões, faturas |
| Entitlements | commerce_entitlement | **nenhum endpoint, nenhuma verificação** | Escrito por trial approve, `settleInvoice`; expirado pelo worker |
| Missões | commerce_mission | nenhum endpoint de cliente | Criadas em trial e pagamento |
| Faturação | billing_* | `GET /v1/billing/invoices[/id/document]`, webhook | — |
