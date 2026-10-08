# CODEX — contrato de execução / FIRST DEVELOPMENT ROUND
**Mandato técnico aprovado para desenvolvimento em ambiente isolado. Não é aprovação para modificar VPS de produção ou sistemas reais de clientes.**

## Objetivo
Levar AtlasHub AI Workforce do conjunto atual de documentos/simulador para **um serviço gerido funcional, demonstrável de ponta a ponta em staging**, com ROLE-001 e base escalável para mais sete roles.

## Começar por estes documentos, nesta ordem
1. `docs/00-EXECUTIVE-BRIEF.md`
2. `docs/01-PRODUCT-PRD.md`
3. `docs/02-TECHNICAL-BLUEPRINT.md`
4. `docs/03-ACCEPTANCE-AND-TESTS.md`
5. `docs/MVP-8-DIGITAL-EMPLOYEES.md`
6. `docs/DEPLOYMENT-VPS-PLAYBOOK.md`
7. `docs/REPOSITORY-AUDIT.md`

## Ambientes e repos
- **Primary**: `atlashub-digital/AtlasHub-AI-WaaS` — implementar backend, workers, tooling, contract schemas, CI e infra staging.
- **Packs**: `atlashub-digital/atlas-agent-packs` — preservar PACK-001, completar implementações vinculadas e definir novos packs sem adulterar catálogo V0; testar compatibilidade.
- **Front**: `atlashub-digital/App.AtlasHub.Si` — Clara, catálogo comercial e portal cliente; preservar demo.
- **EXCLUÍDO**: `atlas-si-os`, PaperClip e infraestrutura de projetos em standby.

## Plano de execução (fases com commits/PRs)
**Gate A — Baseline (sem mutações em produção):** clonar repos, verificar branches/CI, mapear dependências, versões, testes e builds; inventariar infra de forma read-only caso exista acesso. Escrever `docs/BASELINE-VERIFIED.md` com provas. Corrigir desvios documentais primeiro.
**Gate B — Core:** scaffold NestJS/Prisma, Postgres/Redis, APIs OpenAPI, migrations, Auth/RBAC/RLS, tenant membership, deployments, pack pins, tool grants, runs/usage, approvals e auditoria.
**Gate C — Execução:** ingress seguro, routing canal→deployment, BullMQ worker, gateway n8n, validadores, contratos de ferramentas e calendário fake stateful de staging; só envolver Hermes quando necessário. E2E E01–E10.
**Gate D — UI:** catálogo com oito roles (demo/pilot/ga corretos), Clara como consultora de contratação gerida, formulário assessment e portal autentificado de operações/resumos; sem editor n8n.
**Gate E — DevOps:** compose staging, migrations, secrets via env placeholders, health checks, CI, backup/restore, runbook de observabilidade, alertas, rollback e relatório de segurança.
**Gate F — Aceitação:** executar T01–T14 e E01–E10, recolher evidências e emitir `docs/ROUND-1-DELIVERY-REPORT.md`.

## Regras de engenharia
- Seguir contratos do PACK-001 e manter compatibilidade de schema e simulador.
- Não promover packs de demo a pilot/ga apenas por existirem JSONs.
- Commits separados e PRs por repositório; pin dependências e imagens (sem latest).
- Utilizar fixtures fictícias e secrets placeholders; nunca inserir tokens em Git nem enviar dados reais a modelos.
- Persistir contexto tenant/deployment fora do LLM; as ferramentas nunca confiam em outputs de IA como credenciais/autorização.
- Verificar a origem, licença e segurança antes de copiar qualquer template externo.
- Não fornecer ao cliente builder de workflows n8n; cliente vê resultados e pedidos de aprovação.
- Não inventar preço, métrica de ROI, base legal, política de WhatsApp, SLA nem disponibilidade.
- Reportar decisões em ADR com alternativa, motivo, tradeoff e plano de rollback.
- Em caso de bloqueio por credenciais/infra, entregar modo local Docker/staging e indicar requisito específico, sem paralisar o restante.

## Pacote de entrega
1. Código, schemas e CI dos três repos naquilo que foi alterado.
2. Compose de desenvolvimento/staging e `.env.example` não sensível.
3. Testes reproduzíveis + relatório PASS/FAIL.
4. Vídeo opcional/screenshots sintéticos de demonstração.
5. API OpenAPI e exemplos curl sem chaves.
6. Observabilidade, custos, pausa/handoff, segurança, exportação.
7. Backlog remanescente para ativar piloto de cliente real.
8. Sumário executivo do que existe de facto, e do que continua simulado.

**Não terminar com «pronto» antes de demonstrar as funcionalidades E2E.**
