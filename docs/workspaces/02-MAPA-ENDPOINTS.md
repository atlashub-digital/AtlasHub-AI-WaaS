# 02 — Mapa de endpoints: existentes vs necessários

Âmbito: o **frontend operacional mínimo** definido no gate G2 da missão WORKSPACES-FE-001. Inclui shell, login, escolha de tenant, navegação por entitlements, Workforce só de leitura e AMI como placeholder, sem dados reais em demo. Só entram aqui as lacunas que esse âmbito exige.

Legenda: ✅ existe e serve · 🟡 existe, precisa de extensão **aditiva** · 🆕 novo · ⏸ existe, fora do G2 · ⛔ não expor ao Workspaces

## 1. Necessidades do G2 → endpoints

| Necessidade do ecrã (G2) | Endpoint | Estado | Quem pode | Nota |
|---|---|---|---|---|
| Login | Supabase Auth (fora do Core); o Core verifica o JWT por JWKS | ✅ | — | Sem cópia de auth no Workspaces (regra FE-001) |
| Sessão / quem sou | `GET /v1/me` | 🆕 | qualquer JWT válido | `sub`, `email` (se o claim existir), memberships e módulos por tenant |
| Escolha de tenant | `GET /v1/me/memberships` | ✅ PR #7 | qualquer JWT válido | Lista vazia em vez de 403 sem memberships |
| Navegação por entitlements | `GET /v1/entitlements?tenant=` | 🆕 | membros do tenant | Devolve `modules: ["workforce","ami"]` e os itens ativos |
| Workforce: lista de colaboradores | `GET /v1/tenants/{id}/deployments` | ✅ | membros do tenant | Junta `roleId` ao nome do catálogo (`/v1/public/catalog` ou `/v1/roles`) |
| Workforce: nomes e descrições | `GET /v1/public/catalog?locale=` | ✅ (não documentado) | público | Fonte **única** de textos de Workers; o FE não lê `atlas-agent-packs` |
| Workforce: atividade | `GET /v1/runs?tenant=` | 🟡 | membros | Acrescentar `state`, `deploymentId`, `limit` e `cursor` (hoje `take 100` sem filtros) |
| Workforce: detalhe de execução | `GET /v1/runs/{id}?tenant=` | ✅ | membros | Já inclui `events` (só payload seguro) |
| Workforce: aprovações pendentes (ver) | `GET /v1/approvals?tenant=` | 🟡 | membros | Acrescentar `state`; o FE marca como expirada se `expiresAt < now` |
| Workforce: consumo | `GET /v1/usage/summary?tenant=&from=&to=` | 🆕 | membros | Agregado por métrica e estado de runs (hoje só a lista crua `GET /v1/usage`) |
| AMI (placeholder) | `GET /v1/entitlements` → `ami ∈ modules` | 🆕 (o mesmo) | membros | Sem dados AMI no G2 |

**Total para o G2:** 3 endpoints novos (`/v1/me`, `/v1/entitlements`, `/v1/usage/summary`) e 2 extensões aditivas (`/v1/runs` e `/v1/approvals`), além do PR #7. Nada disto exige migration: os dados já existem.

## 2. Existentes fora do G2 (manter, não expor ainda)

| Endpoint | Classe | Quando entra no Workspaces |
|---|---|---|
| `POST /v1/approvals/{id}/decide` | ⏸ escrita de cliente | G4 (piloto Worker real), com auditoria ponta a ponta |
| `GET /v1/billing/invoices`, `…/{id}/document` | ⏸ | Depois do G2, no ecrã de faturação |
| `POST /v1/ops/runs/{id}/retry`, `GET /v1/ops/*`, outros `POST /v1/ops/*` | ⛔ operador AtlasHub | Consola interna, não o Workspaces de cliente |
| `POST /v1/deployments`, `…/transition`, `…/pause` | ⛔ operador (`atlas_*`) | Idem |
| `POST /v1/tenants`, `POST /v1/tenants/{id}/memberships` | ⛔ `atlas_owner`/`atlas_operator` | Convites de cliente: ver 03 §5 |
| `POST /v1/inbound/{provider}`, `POST /v1/webhooks/payments/{provider}` | ⛔ máquina-a-máquina | Nunca |
| `/v1/public/*` (leads, trials, simulate, quotes/accept, concierge) | ⛔ funil de pré-venda | Pertence ao site e ao App, não ao Workspaces |

## 3. Lacunas fora do G2 (registadas, não pedidas agora)

| Lacuna | Para | Proposta |
|---|---|---|
| Leitura de auditoria (`AuditEvent`) | G4 | `GET /v1/audit?tenant=&cursor=` para `tenant_admin` |
| Missões do cliente (`commerce_mission`) | depois do G2 | `GET /v1/missions?tenant=` |
| Convites/onboarding de utilizadores do cliente | depois do G2 | ver 03 §5 |
| Leitura de integrações (`IntegrationConnection`, sem `secretRef`) | depois do G2 | `GET /v1/integrations?tenant=` |
| Documentar no OpenAPI as 20 rotas da Fase B | higiene de contrato | PR de contrato (07, PR-C) |
