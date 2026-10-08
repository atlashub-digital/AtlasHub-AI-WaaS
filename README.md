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

## Ecossistema
| Repositório | Função |
|---|---|
| [atlas-agent-packs](https://github.com/atlashub-digital/atlas-agent-packs) | Packs reutilizáveis versionados; definição técnica de competências |
| [App.AtlasHub.Si](https://github.com/atlashub-digital/App.AtlasHub.Si) | Clara, catálogo, simulador e futuro portal do cliente |
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
