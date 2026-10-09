# 07 — PRs pequenos propostos e testes de aceitação

Regras comuns: um PR por assunto; sem migrations destrutivas; `openapi.json` sobe a versão minor em cada alteração aditiva e `api-types.ts` é regenerado; testes negativos A/B obrigatórios em tudo o que lê dados de tenant; revisão pelo WORKSPACES-QA-001 (Codex oficial) antes do merge; **nenhum merge antes de G0**.

| PR | Repo | Conteúdo | Depende | Estado |
|---|---|---|---|---|
| **#7** | AI-WaaS | `GET /v1/me/memberships` + contrato 0.2.0 | — | **aberto (draft)** |
| **#2** | atlas-agent-packs | `tools` + `policy` no `dist/catalog.json` (0.3.1) | — | **aberto (draft)** |
| **PR-B** | AI-WaaS | Esta documentação, o rascunho de contrato e o `contract-probe` | — | **este PR (draft)** |
| PR-C | AI-WaaS | Contrato: documentar as 20 rotas da Fase B + schemas de resposta das 19 existentes; teste de CI "rota sem contrato falha" | — | proposto |
| PR-D | AI-WaaS | `GET /v1/me` | #7 | proposto |
| PR-E | AI-WaaS | `GET /v1/entitlements` + `POST /v1/ops/entitlements` (`grant`, auditado) | — | proposto |
| PR-G | AI-WaaS | `/v1/runs` e `/v1/approvals` com filtros e cursor (aditivo) + `GET /v1/usage/summary` | — | proposto |
| PR-F | AI-WaaS | Aplicação de entitlements (deployments, worker), atrás de flag | E | depois do G2 |
| PR-H | AI-WaaS | Rate limit por proxy de confiança e por `sub` | ingress (R4) | proposto |
| PR-AMI-1 | packs + AI-WaaS | `PACK-009 ami-collector` (demo, fixtures fictícias) + role `ami.collect` (approval, usage, teto) | E, G3 | depois de G3 |

## Testes de aceitação (critério para fechar cada PR)

### PR-D — `GET /v1/me`
- [ ] JWT válido sem memberships → `200 { sub, memberships: [] }`.
- [ ] `admin-A` → só `tenant-A`, com `name`, `role`, `tenantStatus` e `modules`.
- [ ] Sem token ou com token expirado → 401; token de outro issuer/audience → 401.
- [ ] Nunca devolve memberships de outro `sub` (teste com dois utilizadores no mesmo tenant).

### PR-E — entitlements
- [ ] `viewer-A` `GET /v1/entitlements?tenant=tenant-A` → 200; `?tenant=tenant-B` → 403.
- [ ] `validUntil` no passado ou `status ≠ active` → não aparece; `modules` recalculado.
- [ ] `workforce` presente se houver `mission.*` ativo **ou** deployment; `ami` só com `module.ami`.
- [ ] `POST /v1/ops/entitlements` por `tenant_admin` → 403; por `atlas_operator` com membership → 201 + `AuditEvent` `entitlement.grant`.
- [ ] Repetir o mesmo grant é idempotente (unique `tenantId,key,source,sourceId`).

### PR-G — leituras com filtros e resumo
- [ ] `/v1/runs` sem `limit`/`cursor` → **array idêntico** ao atual (regressão do App.AtlasHub.Si).
- [ ] Com `limit=2` → `{items: 2, nextCursor}`; seguir o cursor percorre tudo sem repetição.
- [ ] `state=completed` filtra; um `state` inválido → 400.
- [ ] `/v1/usage/summary` soma por métrica e conta runs por estado, só do tenant pedido (A ≠ B).

### PR-C — contrato
- [ ] Teste falha se uma rota decorada não estiver em `openapi.json` (o script de [01 §4](01-AUDITORIA.md) passa a teste).
- [ ] `openapi-typescript` regenera `api-types.ts` sem diferenças em CI.

### Transversal (todos)
- [ ] CI completa verde em Postgres 17.6: check, e2e, database-security, runtime-rls, roles, commerce, readiness-recovery, backup-restore.
- [ ] `scripts/contract-probe.mjs` → todas as verificações conforme esperado no estado do PR.
- [ ] Nenhum segredo, IP, hostname interno ou dado real nos diffs (repositório público).
