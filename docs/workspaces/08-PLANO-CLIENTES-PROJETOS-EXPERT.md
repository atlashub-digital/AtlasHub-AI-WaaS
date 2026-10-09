# 08 — Plano técnico integrado: Cliente · Tenant · Projeto · Expert

**Estado:** proposta (WORKSPACES V1). Sem merge, deploy nem migrations antes dos gates.
**Liderança técnica:** Claude Code assume o Workspaces de ponta a ponta (frontend `AtlasHub-Workspaces` e backend `AtlasHub-AI-WaaS`). O Codex oficial revê. O Founder aprova as decisões classe D.
**Referências:** ADR-0003 (ventures próprias tratadas como clientes-piloto) e as propostas privadas em `atlas-ops`. A identificação dos clientes-piloto reais vive **só** no `atlas-ops`, que é privado; este repositório é público e usa designações genéricas.

## 1. Hierarquia e fronteiras

```text
AtlasHub (operador da plataforma; tenant interno "atlashub")
└── Conta comercial (Customer Account) ......... relação comercial; pode agrupar marcas — NÃO é fronteira de autorização
    └── Organização = Tenant ...................... fronteira estrita: RLS, credenciais, custos, membros, auditoria
        ├── Membros (Membership) .................. tenant_user · tenant_admin · supervisor AtlasHub (atlas_operator) com membership explícita
        ├── Módulos de produto (entitlements) ..... module.workforce · module.ami · module.community · …
        ├── Projetos .............................. iniciativas/produtos do cliente (ex.: "Inteligência de mercado", "Comunidade")
        │   └── Deployments (composições de Roles/Packs) → Missões → Runs → Approvals → Usage/Audit
        └── Atlas Expert .......................... 1 deployment lógico por tenant; coordena, não executa sem autorização
```

| Conceito | Tabela/contrato existente | Reutilização | Novo (aditivo, com gate) |
|---|---|---|---|
| **Conta comercial** | `crm_company` (tenant `atlashub`), ligada a tenants por `commerce_quote.customerTenantId` / `commerce_trial.customerTenantId` | A relação conta → tenants já é derivável | Agrupamento de marcas (propriedade comum): `crm_company.parentCompanyId` **só quando houver verificação legal**. Nunca dá acesso cruzado |
| **Organização / Tenant** | `Tenant` (`id`, `slug`, `name`, `status`) + RLS | Tal como está | `Tenant.kind` (`customer` · `internal_pilot` · `platform`) e `Tenant.sandbox` (bool). **Bloqueia a apresentação pública** de pilotos internos como clientes externos (ADR-0003/ATL-D10) |
| **Membro / Supervisor** | `Membership` (`tenant_user`, `tenant_admin`, `atlas_operator`, `atlas_engineer`, `atlas_owner`) | O supervisor AtlasHub é `atlas_operator` **com membership no tenant que supervisiona**, e só nesse | — |
| **Módulo de produto** | `commerce_entitlement` (`mission.*`, `product.*`, fonte `grant` já prevista) | Convenção **aceite**: `module.<nome>` | `packages/contracts/modules.json` (contrato versionado, sem tabela): módulo → roles, prefixos de tools e produtos que o concedem |
| **Projeto** | — (não existe) | Até à migration: `Deployment.config.projectId` (JSON) em sandbox | Tabela `project` (`id`, `tenantId`, `slug`, `name`, `status`, `modules[]`, `supervisorUserId`) com RLS, e `projectId` *nullable* em `Deployment` e `commerce_mission` |
| **Composição de Worker** | `Role` + `PackRelease` (+ `tools` com política, packs PR #2) | É o catálogo único; um Role pode compor vários packs | Campo `composes[]` no manifesto do pack (atlas-agent-packs) para composições |
| **Deployment / Run / Approval / Usage / Audit** | Existem e estão testados | Sem alterações de modelo | — |
| **Atlas Expert** | `Role` + `Deployment` + tool gateway + `Approval` | 1 deployment por tenant de um Role novo `ROLE-EXPERT` (pack `atlas-integration-expert`) | Conversa persistente (`expert_thread`/`expert_message`) só na fase E2; na E1 usa `TaskRun`/`TaskEvent` |

**Migration 007 (proposta, aditiva):** `project`, `Tenant.kind`, `Tenant.sandbox`, `Deployment.projectId`, `commerce_mission.projectId`. Sem `DROP` nem alterações de tipo. Exige G1 e aprovação classe D antes de correr fora do staging local.

## 2. Clientes-piloto de sandbox (designação pública genérica)

| Designação neste repositório | Natureza (ADR-0003) | Tenant sandbox | Projetos iniciais | Módulos | Supervisor (papel) |
|---|---|---|---|---|---|
| Cliente-piloto A | cliente externo em piloto | `pilot-a-sandbox` | Inteligência de mercado (AMI) · Comércio digital · Operações de marketing | `workforce`, `ami` | Supervisor AMI |
| Cliente-piloto B | venture própria (`internal_pilot`) | `pilot-b-sandbox` | Comunidade e acompanhamento de membros · Atendimento · Conteúdo | `workforce`, `community` | Supervisora B/C |
| Cliente-piloto C | venture própria (`internal_pilot`), frente independente | `pilot-c-sandbox` | Marketing · Produtos digitais | `workforce` | Supervisora B/C |

- **Sem relação societária presumida** entre A, B e C. Cada um é um tenant isolado.
- Se se provar propriedade comum, liga-se só a Conta comercial (`parentCompanyId`), nunca os tenants.
- O mapeamento para nomes reais, supervisores e contactos está em `atlas-ops` (privado).
- Todos os dados de sandbox são **sintéticos** e rotulados "Sandbox · dados sintéticos" na UI.

## 3. Atlas Expert

**O que é:** uma composição de Worker dedicada **logicamente** a um tenant, ou seja, um deployment e não uma VPS nem uma conta Hermes privilegiada. Recebe necessidades, prepara planos, propõe integrações e composições, coordena execuções **autorizadas** e acompanha resultados.

| Tool | Política | Efeito |
|---|---|---|
| `expert.read_context` | auto | Lê só dados do próprio tenant: projetos, deployments, runs, usage, entitlements |
| `expert.draft_plan` | auto | Produz um plano estruturado (rascunho) em `TaskRun.result` |
| `expert.propose_integration` | **approval** | Propõe um conector (provider, âmbito, dados, custo). Não cria credenciais |
| `expert.propose_composition` | **approval** | Propõe Roles/Packs para um projeto. O deployment continua a ser criado por um operador (`POST /v1/deployments`) |
| `expert.request_run` | **approval** | Pede um run a outro deployment **do mesmo tenant e projeto**. O gateway valida o tenant, o projeto e o entitlement |
| shell, segredos, DNS, deploy, pagamentos, publicação, gasto | **forbidden** | Fora do manifesto, listados nos guardrails, testados como negativos |

O Expert **não** tem `service_role`, **não** fala com o n8n ou o Hermes fora do gateway e **não** ultrapassa o entitlement do tenant. As aprovações vão para o `handoff_queue` do deployment (o supervisor). Decisões classe D (gasto, produção, publicação) continuam no Founder.

**Produtos de comunidade do cliente não são o Expert.** O assistente de comunidade e acompanhamento de membros do cliente-piloto B é um **produto desse cliente**, modelado como **projeto** do tenant com deployments próprios (módulo `community`). Pode reutilizar capacidades comuns, como comunicação, conteúdo e segurança, mas tem regras próprias: consentimento, minimização, escalonamento humano e nenhum conselho médico. O Expert do tenant B coordena integrações desse tenant e não conversa com membros da comunidade. A identificação do produto real está no `atlas-ops`.

## 4. AMI como módulo de produto

**AMI = módulo `module.ami`, com UX própria no Workspaces, implementado por vários Roles/Packs reutilizáveis no Core.** Não é um único Role nem um control plane.

| Pack/Role candidato | Função | Tools (política) |
|---|---|---|
| `ami.market-intelligence` | Recolha de anúncios e ofertas de fontes autorizadas; saída `ami.ads.v1` com proveniência e custo | `ami.collect` (**approval**, custo), `ami.normalize` (auto) |
| `commerce.offer-research` | Classificação de ofertas com critérios, fonte e risco | `offer.classify` (auto) |
| `growth.analytics` | Métricas medidas, sem ROI fictício | `analytics.report` (auto) |

O módulo declara em `modules.json` que roles e prefixos de tools cobre. O coletor do supervisor AMI corre fora do Core e é chamado pelo adaptador n8n/Hermes existente. Detalhe e fases em [05-PLANO-AMI.md](05-PLANO-AMI.md).

## 5. Verificação de entitlements (decisão aceite)

| Ponto | Regra | Falha |
|---|---|---|
| **API** | Rotas de módulo (`/v1/ami/*`, …) e `POST /v1/deployments` exigem o módulo ou a missão que cobre o `roleId` | 403 `entitlement_required` |
| **Inbound** | Criação de run sem entitlement ativo | Run criado em `suspended` (estado já existente), motivo `entitlement_missing` |
| **Worker** | Volta a verificar antes de executar (o entitlement pode expirar a meio) | `blocked`, motivo `entitlement_expired` |
| **Tool gateway** | Cada tool tem o módulo do seu prefixo (`ami.*` → `module.ami`) | `RolePolicyError('entitlement_missing')`, com evento `policy.denied` |

Implementação num só módulo puro (`packages/contracts/entitlements.ts`): `activeKeys(tx, tenantId, now)`, `modulesOf(keys)`, `allowsRole(keys, roleId)`, `allowsTool(keys, toolId)`.

Os seeds sintéticos concedem `module.workforce` aos tenants A/B de teste para que **as suites atuais passem sem alterações**. A aplicação entra atrás de `ENTITLEMENTS_ENFORCE=1`: ligado na CI e desligado por omissão em staging até os seeds estarem aplicados.

## 6. HTTPS para o Core (preparação, sem exposição)

1. Um **hostname dedicado** à API do Core, separado do staging e do Workspaces, com TLS no edge existente. O staging continua só em loopback.
2. **Allowlist de caminhos no edge:** `/health`, `/v1/me*`, `/v1/entitlements`, `/v1/projects*`, `/v1/tenants/*/deployments`, `/v1/runs*`, `/v1/approvals*`, `/v1/usage*`, `/v1/public/*`. **`/v1/ops/*`, `/v1/inbound/*` e `/v1/webhooks/*` ficam fora** ou atrás de allowlist de origem.
3. Proxy de confiança (`X-Forwarded-For` só do edge) e limite por `sub` nas rotas autenticadas.
4. **Sem CORS:** o Workspaces chama o Core a partir do BFF (servidor Next).
5. Antes de ativar: testes de segurança (cabeçalhos, `/v1/ops` inacessível, 401/403), plano de rollback (retirar o site do edge) e aprovação do Founder (G0/P0).

## 7. Frontend Workspaces (Claude)

- Repositório `AtlasHub-Workspaces`, branch `feat/workspaces-shell` e PR em draft, sem deploy.
- **Visual Pack preservado:** mesmos tokens, fontes, logótipo, botões, cartões e brilho do App (`ah-*`) e do site. A maquete 05 é a referência visual, mas a UI é feita de componentes reais (não `MockupCanvas`).
- Rotas: `/login` · `/` (escolha de organização) · `/o/[tenant]` (visão geral) · `…/projects/[project]` · `…/workforce` · `…/expert` · `…/ami` · `…/approvals` · `…/usage`.
- Camada de dados com duas implementações do mesmo contrato:
  - `CORE_MODE=demo`, por omissão: fixtures sintéticas que respeitam o isolamento por membership;
  - `CORE_MODE=api`: BFF → Core com o token em cookie HttpOnly.
- O frontend esconde módulos sem entitlement, **mas a autoridade é o Core** (403).

## 8. Sequência de PRs

| Ordem | Repo | PR | Gate |
|---|---|---|---|
| 1 | AI-WaaS | #7 `GET /v1/me/memberships` (QA) | G1 |
| 2 | atlas-agent-packs | #2 `tools`/`policy` no catálogo (a autorização fica no Core) | G1 |
| 3 | AI-WaaS | #8 estes documentos e contratos | G1 |
| 4 | Workspaces | `feat/workspaces-shell`: shell, demo e testes | G2 (sem deploy) |
| 5 | AI-WaaS | `GET /v1/me` + `GET /v1/entitlements` + `modules.json` + `entitlements.ts` | G1 |
| 6 | AI-WaaS | Aplicação de entitlements (API, inbound, worker, gateway) atrás de flag + seeds | G1 |
| 7 | AI-WaaS | Migration 007 aditiva (`project`, `Tenant.kind/sandbox`, `projectId`) + `GET /v1/projects*` | G1 + classe D |
| 8 | packs + AI-WaaS | `ROLE-EXPERT` / pack `atlas-integration-expert` em demo + testes negativos | G2 |
| 9 | packs + AI-WaaS | Packs AMI (`ami.market-intelligence`, …) em demo com fixtures `ami.ads.v1` | G3 |
| 10 | AI-WaaS | Ingress HTTPS (configuração revista, sem ativação) | G0/P0 |

Cada PR traz testes A/B negativos, CI verde, `contract-probe` atualizado e nenhuma referência a dados reais.
