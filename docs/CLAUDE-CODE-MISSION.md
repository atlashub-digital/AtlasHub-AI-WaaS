# Missão executável para Claude Code — AI-WaaS Sprint 0/1

És Lead Engineer de AtlasHub AI Workforce. Fonte de verdade: este repositório, principalmente `docs/PROJECT-CHARTER.md`, `docs/ARCHITECTURE.md`, `docs/MVP-8-DIGITAL-EMPLOYEES.md` e `docs/DEPLOYMENT-VPS-PLAYBOOK.md`.

## Missão 0: prova de estado
- Inspecionar 3 repositórios: AtlasHub-AI-WaaS, atlas-agent-packs e App.AtlasHub.Si.
- Executar CI/testes builds em ambiente isolado; descrever falhas sem ocultar resultados.
- Inventariar VPS, n8n, Redis, Supabase, Hermes, Chatwoot, Evolution, Caddy e Vercel com comandos read-only.
- Apresentar escolha explícita de VPS e riscos. Não instalar nem fazer deploy antes da verificação de permissões e plano de rollback.

## Missão 1: produto operacional
- Construir primeiro ROLE-001 (Rececionista Digital) usando PACK-001 existente, sem reescrever manifesto, simulador ou métricas.
- Criar serviço mínimo ai-waas-api (NestJS), worker assíncrono (BullMQ), modelo tenant/deployment/run/usage/approval, e tool gateway.
- Integrar **primeiro** um sistema de calendário sandbox e mensagens fictícias via n8n. Não ligar WhatsApp real na primeira prova.
- Validar contratos de tool existentes, criar fixtures e executores reais. Escrever testes: felicidade, exceção, duplicidade, timeout, isolamento tenant, injection, revogação e kill switch.
- Garantir que o gateway aplica regras server-side independente do LLM.
- Acrescentar observabilidade, custos unitários, rota de pausa e handoff.

## Missão 2: oferta comercial
- No App.AtlasHub.Si, manter Clara e simulador funcionando, acrescentando catálogo de funções geridas, CTA de avaliação, sem preços fictícios e com separação inequívoca entre demo e operação.
- Preparar ROLE-002 e ROLE-003 em estado demo sem comprometer entrega da ROLE-001.
- Escrever proposta de serviço gerido com limites, SLA e critérios de aceitação; revisão jurídica à parte.

## Forma de trabalhar
PRs pequenos, migrations reversíveis, feature flags e documentação em cada PR. Nunca editar o projeto PaperClip/atlas-si-os. Nunca executar serviços de produção nem expor chaves. Registar decisão arquitetural e responsabilidades no AI-WaaS.

## Entrega de cada sprint
Arquivos alterados, branches/PRs, testes e logs sanitizados, evidências E2E, infraestrutura necessária, custos mensurados, riscos, blockers, próximas tarefas e decisão GO/NO-GO.
