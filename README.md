# AtlasHub AI Workforce — Employee Factory

**AI Workforce as a Service (AI-WaaS)** · AtlasHub.SI · Início: 2026-10-07

> A AtlasHub disponibiliza **colaboradores digitais geridos** para executar funções empresariais delimitadas. O cliente contrata um serviço continuado; a AtlasHub implementa, opera, supervisiona, suporta e melhora. **Não se trata de instalar software no cliente nem de uma agência legal de trabalho temporário.**

## Começar aqui — edição para Codex (2026-10-07)

**Ordem obrigatória de leitura para Round 1:**
1. [Executive Brief](docs/00-EXECUTIVE-BRIEF.md)
2. [PRD — Requisitos de produto](docs/01-PRODUCT-PRD.md)
3. [Blueprint técnico](docs/02-TECHNICAL-BLUEPRINT.md)
4. [Critérios de aceitação e testes](docs/03-ACCEPTANCE-AND-TESTS.md)
5. [Contrato de execução para Codex](docs/04-CODEX-EXECUTION-BRIEF.md)
6. [Riscos e decisões](docs/05-RISKS-AND-DECISIONS.md)

## Documentos de apoio e histórico
1. [Project Charter — visão, modelo de negócio e MVP](docs/PROJECT-CHARTER.md)
2. [Auditoria dos repositórios existentes](docs/REPOSITORY-AUDIT.md)
3. [Arquitetura AI-WaaS](docs/ARCHITECTURE.md)
4. [Roadmap e backlog dos primeiros 30 dias](docs/ROADMAP-30-DAYS.md)
5. [Catálogo MVP de 8 colaboradores](docs/MVP-8-DIGITAL-EMPLOYEES.md)
6. [Playbook de implantação VPS](docs/DEPLOYMENT-VPS-PLAYBOOK.md)
7. [Missão Claude Code — Sprint 0/1](docs/CLAUDE-CODE-MISSION.md)
8. [Frontends ligados a esta API — o que falta tratar no backend](docs/FRONTENDS.md)

## Ecossistema
| Repositório | Função |
|---|---|
| [atlas-agent-packs](https://github.com/atlashub-digital/atlas-agent-packs) | Packs reutilizáveis versionados; definição técnica de competências |
| [App.AtlasHub.Si](https://github.com/atlashub-digital/App.AtlasHub.Si) | Clara, catálogo, simulador e futuro portal do cliente |
| [AtlasHub.Si](https://github.com/atlashub-digital/AtlasHub.Si) | Site institucional e Clara de pré-análise (leads) |
| **AtlasHub-AI-WaaS** | Fonte principal de verdade comercial e operacional, subscrições e deployments |
| **AI-WaaS Operations** | Coordenação e supervisão operacional no próprio projeto; sem dependência de PaperClip |

## Conceitos fundamentais
**Pack** = capacidade técnica reutilizável. **Role** = colaborador digital como oferta comercial. **Deployment** = instância contratada e isolada para um cliente. **Managed Service** = execução com SLA, monitorização, revisão humana e suporte.

## Estado
- PACK-001 Confirmação de Consultas: **demonstração**, não produção.
- App simulador V0: implementado em código com testes documentados, **deploy/build final por verificar**.
- Operação gerida multi-tenant: **por implementar e testar**.
- Primeira oferta recomendada: Rececionista Digital Gerida (tarefas administrativas de agenda e triagem).

## Regras
Não alegar colaboradores ativos ou resultados garantidos antes de homologação. Sem credenciais no Git; sem dados reais em demos; tudo isolado por tenant; custos, incidentes e execuções observáveis; aprovações para ações sensíveis. Desenvolver nos repositórios correspondentes, não duplicar o que já existe.

## A próxima tarefa
Auditar CI, builds e infraestrutura; construir o primeiro workflow real do PACK-001; criar o control plane mínimo, e depois ativar piloto assistido. Ver [Roadmap](docs/ROADMAP-30-DAYS.md).

## Round 2 — staging remoto, RLS e os 8 colaboradores

Estado atual em [ROUND-2-STATUS.md](docs/ROUND-2-STATUS.md); alinhamento com o pedido em [ROUND-2-ALIGNMENT.md](docs/ROUND-2-ALIGNMENT.md); modelo comercial (leads, catálogo, missões, faturação, pagamentos, Clara, multilíngue) em [DATA-MODEL-v2.md](docs/DATA-MODEL-v2.md).

- **Os 8 colaboradores** (ROLE-001..008) funcionam ponta a ponta em staging remoto contra sistemas sandbox, com aprovação humana nas ações externas e ações proibidas bloqueadas no servidor. Ver [ROLES.md](docs/ROLES.md).
- **Isolamento:** a app corre como `waas_runtime` (sem `BYPASSRLS`) com RLS por tenant no caminho real, provado no staging e no Supabase.
- **IA:** a camada Claude é opcional e está desligada por defeito; nunca decide permissões.
- **Ainda não homologado:** integrações reais (CRM, email, ERP, loja, ATS, redes sociais), workflows n8n ativos, Auth Supabase real com utilizadores e canal WhatsApp. Nenhum colaborador é anunciado como operacional.

## Round 1 — desenvolvimento local e staging sintético

Implementação em branch, ainda **não homologada nem instalada na VPS**. Backend NestJS, Prisma/PostgreSQL, worker BullMQ/Redis, calendário sintético transacional e contratos OpenAPI. O frontend e os packs continuam nos seus próprios repositórios. Ver [relatório de entrega](docs/ROUND-1-DELIVERY-REPORT.md) para evidências e limitações; os requisitos originais acima continuam válidos.

Requisitos: Node ≥22, npm e Docker Compose. O ambiente cloud já é isolado; utilizar os checkouts existentes, sem criar worktrees.

```bash
cd /workspace/AtlasHub-AI-WaaS
npm ci
scripts/staging.sh
set -a
source .env.staging
set +a
npm run api       # terminal 1
npm run worker    # terminal 2, carregar o mesmo .env.staging
```

`init-staging.mjs` cria segredos aleatórios **apenas locais**, fora do Git, e preserva ficheiros existentes. `db:seed` só funciona na base dedicada `waas_staging`, usa dados fictícios e não apaga dados. Não usar estas credenciais ou o modo JWT partilhado fora de staging. Migrations: `npm run db:deploy`; SQL versionado e checksums; runner alternativo documentado em ADR-001.

```bash
npm run check
npm run test:e2e                       # API e worker devem estar ativos
node --test tests/database-security.mjs
node scripts/readiness-recovery.mjs    # interrompe apenas o Postgres deste Compose
scripts/backup-restore.sh              # restaura numa base separada waas_restore
```

Para repetir E2E, parar o worker antes de `ALLOW_STAGING_RESET=1 node scripts/reset-fixtures.mjs`, voltar a iniciá-lo e executar testes. Este comando limpa **somente os tenants sintéticos A/B** na base dedicada. Nunca apontá-lo ao Supabase nem a dados de cliente. `waas_restore` deve não existir antes do teste de restore; uma base existente não é substituída.

Frontend: `cd /workspace/App.AtlasHub.Si && npm ci && npm run build && npm run start -- --hostname 127.0.0.1`. `WAAS_API_URL` é server-side; omissão usa API local. `node tests/browser.mjs` no backend verifica frontend e portal com uma sessão JWT sintética injetada pelo teste; não valida login Supabase.

Modo container opcional: após bootstrap e construção da imagem, `docker compose --env-file .env.staging -f infra/compose.yml --profile application up -d --build`. Parar previamente os processos API/worker locais para evitar conflito. Todas as portas estão limitadas a loopback; uma implantação remota exige proxy TLS e revisão do inventário.

Contratos: [OpenAPI](packages/contracts/openapi.json), [tipos gerados](packages/contracts/api-types.ts), [API](docs/API.md), [segurança](docs/THREAT-MODEL.md), [operações](docs/runbooks/OPERATIONS.md). A agenda é uma base sintética stateful. O adaptador n8n está testado contra um servidor HTTP sintético, mas **não está ativado no executor**; não há comunicação real de WhatsApp, CRM ou email.

No cloud, o build Docker online falhou por DNS dentro do builder. Alternativa verificada, sem desativar integridade: `docker --config /workspace/.docker-build build --build-context npmcache=/workspace/.npm-cache -f infra/Dockerfile.offline -t atlashub-waas:round1 .`. Este modo reaproveita somente o cache npm com hashes do lockfile, não inclui env/credenciais, e executa a geração explícita Prisma após `npm ci --offline --ignore-scripts`. O Dockerfile normal destina-se a builders com acesso ao registry configurado.
