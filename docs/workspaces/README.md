# WORKSPACES V1 — Core ↔ Workspaces: auditoria, contrato e plano

**Missão:** WORKSPACES V1 (Claude Code: liderança técnica integral, frontend e backend) · **Data:** 2026-10-09 · **Estado:** proposta, a aguardar a ratificação de G0 e a revisão do WORKSPACES-QA-001.
**Decisão de base:** o AI-WaaS evolui como **AtlasHub Platform Core**, o backend partilhado entre o AI Workforce, o AMI e os módulos futuros. Não há reescrita nem um segundo control plane.

> Este PR **não altera código de produção, migrations, segredos nem deploys**. Contém documentação, um rascunho de contrato e um script de verificação só de leitura. Está dentro do congelamento da Diretiva V1, que permite auditorias, especificações e planeamento.

| # | Documento | Responde a |
|---|---|---|
| 1 | [01-AUDITORIA.md](01-AUDITORIA.md) | Estado real: testes, contrato OpenAPI vs rotas, branches, RLS — com evidências |
| 2 | [02-MAPA-ENDPOINTS.md](02-MAPA-ENDPOINTS.md) | Endpoints existentes vs necessários para o frontend operacional mínimo (G2) |
| 3 | [03-AUTH-ENTITLEMENTS.md](03-AUTH-ENTITLEMENTS.md) | Autenticação, memberships, papéis, isolamento e plano de entitlements |
| 4 | [04-CONTRATO-WORKSPACES.md](04-CONTRATO-WORKSPACES.md) | Contrato Workspaces ↔ Core: regras, formas, erros, versões |
| 5 | [05-PLANO-AMI.md](05-PLANO-AMI.md) | Integração do AMI reutilizando missões, aprovações e uso |
| 6 | [06-RISCOS.md](06-RISCOS.md) | Riscos e decisões pedidas ao Founder |
| 7 | [07-PRS-E-ACEITACAO.md](07-PRS-E-ACEITACAO.md) | PRs pequenos propostos, ordem e testes de aceitação |
| 8 | [08-PLANO-CLIENTES-PROJETOS-EXPERT.md](08-PLANO-CLIENTES-PROJETOS-EXPERT.md) | **Plano integrado Cliente · Tenant · Projeto · Expert**, AMI como módulo, verificação de entitlements, HTTPS, frontend |
| — | [core-workspaces-v1.draft.openapi.json](core-workspaces-v1.draft.openapi.json) | Rascunho OpenAPI 3.1 da superfície Workspaces (`x-status` por operação) |
| — | [`scripts/contract-probe.mjs`](../../scripts/contract-probe.mjs) | Verificação só de leitura do contrato contra uma API local de staging |

## Decisões do Founder de 09/10 (refletidas aqui)

- Claude Code lidera o Workspaces de ponta a ponta. O Visual Pack aprovado é preservado integralmente.
- O Workspaces organiza-se por **clientes/organizações e projetos**. As ventures próprias são clientes-piloto (ADR-0003) e nunca são apresentadas como clientes externos.
- Convenção `module.<nome>` **aceite**. Os entitlements são verificados no backend, no worker e no tool gateway.
- O AMI é um **módulo de produto** composto por Roles/Packs. Entra o **Atlas Expert** por tenant, sem acessos irrestritos.
- O PR #7 mantém-se (sujeito a QA). No packs #2, a autorização efetiva fica no Core.

## Resumo da auditoria (8 linhas)

1. O backend está **saudável**: com `waas_runtime` (RLS ativo), as suites deram build/unitários 14/14, E2E 14/14, segurança da DB 2/2, RLS 6/6, roles 11/11 e commerce 8/8.
2. Isolamento por tenant **verificado ao vivo**: 16/16 verificações do `contract-probe` (401 sem token, 403 cruzado entre tenants, 403 de cliente no CRM interno).
3. **Desvio de contrato:** o `openapi.json` 0.1.0 documenta 19 de 39 rotas. Faltam as 20 da Fase B (commerce, CRM, billing) e `/v1/me/memberships`. Nenhuma rota tem schema de resposta.
4. **Entitlements são escritos mas nunca verificados**: são criados no trial, no pagamento e na expiração, e nenhuma rota nem o worker os consulta. Esta é a maior lacuna para o Workspaces.
5. Branches: `feat/me-memberships` foi reconciliada e documentada no contrato → **PR #7 (draft)**. `feat/catalog-tools` (atlas-agent-packs) → **PR #2 (draft)**. O antigo PR #6 do AI-WaaS já está em `main`.
6. O frontend mínimo (G2) precisa só de **3 endpoints novos**: `GET /v1/me`, `GET /v1/entitlements` e `GET /v1/usage/summary`. Precisa também de filtros e cursor aditivos em `/v1/runs` e `/v1/approvals`. Nenhum exige migration destrutiva.
7. O AMI integra-se como **módulo de produto composto por Roles/Packs do catálogo existente** (não é um segundo catálogo), com o tool `ami.collect` sob política `approval` e custo em `UsageRecord`. O módulo é ligado pelo entitlement `module.ami`.
8. Bloqueios fora do código: ratificação de G0, visibilidade pública dos repositórios (F23), ingress HTTPS do Core e repositório Workspaces ainda vazio (só README).
