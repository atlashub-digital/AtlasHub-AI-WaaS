# CLAUDE.md — AtlasHub-AI-WaaS

Control plane dos colaboradores digitais geridos pela AtlasHub: API NestJS, worker BullMQ, motor de roles (8 colaboradores), Postgres/Supabase com RLS por tenant. Detalhe: `README.md`, `docs/ROUND-2-STATUS.md`, `docs/ROLES.md`, `docs/DATA-MODEL-v2.md`.

## Comandos
Node ≥ 22, Docker Compose.
- `npm ci` e depois `scripts/staging.sh`: Postgres/Redis locais, migrations, role de runtime, seeds e build.
- `npm run check`: build + testes unitários.
- Com a API e o worker a correr como `waas_runtime` (`DATABASE_URL="$APP_DATABASE_URL"`): `npm run test:e2e`, `node --test tests/database-security.mjs tests/runtime-rls.mjs tests/roles.e2e.mjs`.
- Entre corridas de `tests/e2e.mjs`: parar o worker, `ALLOW_STAGING_RESET=1 node scripts/reset-fixtures.mjs`, voltar a arrancá-lo.
- Staging remoto: `scripts/deploy-staging-remote.sh` (projeto Compose isolado `ai-waas-staging`).
- Depois de mudar `packages/roles`: `node scripts/roles-doc.mjs` (regenera `docs/ROLES.md`).

## Regras de ouro
1. A app liga-se sempre como `waas_runtime` e cada query corre em `withDb`/`scoped` com o contexto de tenant. Nunca usar a role dona no caminho do pedido.
2. Todas as tabelas novas: `tenantId`, RLS (`tenant_isolation` + `platform_operator`), grants só para `waas_runtime`, testes negativos A/B.
3. Autorização, grants, aprovações e tenant nunca dependem do texto recebido nem da IA. A IA está desligada por defeito e só classifica ou redige rascunhos.
4. Ações com impacto externo são `approval`; ações perigosas são `forbidden`. Os guardrails só se apertam.
5. Sem segredos, dados reais ou detalhes de infraestrutura neste repositório: é público. A auditoria das VPS vive no `atlas-ops`, que é privado.
6. Migrations são forward-only, com checksum; nunca editar uma migration já aplicada fora do staging.

## O que não mexer
- O executor da ROLE-001 em `services/worker/src/executor.ts` (Round 1, Codex): só acrescentar despacho, não reescrever.
- `packages/contracts/openapi.json` e `api-types.ts` são contratos publicados: mudar só com versão.
- Os serviços de produção nas VPS (LeveLab/LIA, EspelhoMeu, Atendimento.Center, Chatwoot, Evolution, n8n, Caddy): nada sem autorização explícita.
- PaperClip / atlas-si-os: fora de âmbito.
