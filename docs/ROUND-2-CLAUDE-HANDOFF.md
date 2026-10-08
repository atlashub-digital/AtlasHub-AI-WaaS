# Round 2 — Transferência operacional para Claude Code

**Projeto:** AtlasHub AI Workforce — Employee Factory  
**Data:** 2026-10-08  
**Estado:** handoff autorizado para auditoria não destrutiva e preparação de staging; produção exige aprovação expressa.  
**Fonte de verdade:** este repositório, branch main.

## Contexto atual
O Codex concluiu Round 1 em staging local sintético. Três PRs foram integrados:
- AI-WaaS Core: https://github.com/atlashub-digital/AtlasHub-AI-WaaS/pull/6
- Frontend: https://github.com/atlashub-digital/App.AtlasHub.Si/pull/1
- Packs: https://github.com/atlashub-digital/atlas-agent-packs/pull/1

Ler antes de alterar: `README.md`, `docs/ROUND-1-DELIVERY-REPORT.md`, `docs/02-TECHNICAL-BLUEPRINT.md`, `docs/API.md`, `docs/THREAT-MODEL.md`, `docs/adr/001-staging-runtime-and-migrations.md`, `docs/runbooks/OPERATIONS.md`, `docs/03-ACCEPTANCE-AND-TESTS.md` e `docs/05-RISKS-AND-DECISIONS.md`. O relatório Round 1 contém referências a PRs em draft desatualizadas; os três já foram merged conforme GitHub.

## Objetivo
Transformar o vertical slice sintético do ROLE-001 — Rececionista Digital — numa execução auditável em staging remoto, aproveitando infraestrutura existente nas VPS. Não promover a produção nem afirmar homologação até validar todas as condições.

## Fase A — Auditoria read-only
1. Confirmar quais VPS e containers pertencem à AtlasHub, estado de recursos, rede/proxy, bancos, backups e serviços.
2. Localizar n8n, Hermes, Chatwoot/Evolution/Atendimento.Center, Redis, Supabase/Postgres, Caddy e ferramentas de CI/deploy.
3. Inspecionar IAM, configuração de segredo, políticas de comunicação e compatibilidade de conectores, sem expor valores confidenciais.
4. Confirmar acesso e estado real do Supabase; *não* reconstruir ou eliminar base apenas com URL ou autorização genérica passada.
5. Produzir `docs/ROUND-2-INFRA-AUDIT.md`: topologia real, risco, compatibilidade e proposta de staging.
**Gate A:** não modificar serviços existentes antes da revisão do inventário.

## Fase B — Staging controlado
1. Criar ambiente isolado por rede, hostname e credenciais, backup/rollback, sem interrupção de produção.
2. Deploy API/worker AI-WaaS de branches versionadas; test health/ready, Redis/DB e filas.
3. Criar role DB de mínimo privilégio e testar tenant scoping/RLS com ligação de runtime real; não utilizar owner/service_role como runtime.
4. Configurar login Supabase real e membership, com utilizadores de teste, sem segredo no Git.
5. Configurar logs/redação, métricas, quotas, alerta e kill switch.
**Gate B:** testes básicos de autenticação, isolamento, restore e rollback.

## Fase C — Integração de serviço
1. Reutilizar n8n já instalado (não duplicar sem decisão técnica).
2. Implementar e homologar as cinco tools do PACK-001 conforme contratos, usando agenda de staging, consentimento sintético e canal de teste.
3. Manter Hermes opcional: executar via motor determinístico enquanto suficiente. Se usar Hermes, limitar ferramentas e inputs, sem shell/SSH.
4. Integrar Chatwoot/Evolution somente em caixa de testes autorizada; respeitar regras WhatsApp e aprovação humana.
5. Fazer E01–E10 em staging remoto incluindo idempotência, corrida de reservas, handoff, bloqueio de consentimento e isolamento tenants.
**Gate C:** nenhum dado real de paciente ou saída comercial live até homologação.

## Fase D — Evidências
Executar T01–T14 e E01–E10; identificar PASS/PARTIAL/FAIL separadamente para local e remoto. Produzir `docs/ROUND-2-DELIVERY-REPORT.md`, desenhos de arquitetura real, inventário sanitizado, PRs e lista de bloqueios. Pedir aprovação explícita para piloto real antes de alteração de DNS/produção.

## Coordenação com Codex
Claude Code é owner da **infraestrutura e integrações** neste round; Codex mantém revisão de código, testes de segurança e PRs de lógica se necessário. Publicar tudo por PR no repositório correto e não editar diretamente main. Nunca alterar o projeto PaperClip/atlas-si-os.

## Restrições absolutas
Não interromper serviços existentes; não `docker compose down -v`, não eliminar volumes ou bases, não alterar firewall, DNS ou certificados sem aprovação; não publicar portas administrativas; não enviar tokens/chaves para Git ou chat; não inferir que uma VPS é descartável; nenhum deploy em produção sem autorização expressa.

## Primeira entrega requerida
Uma auditoria factual da infraestrutura e recomendação de topologia; em seguida, implementação de staging testada. Informar qualquer falta de acesso concretamente, sem pedir segredos em texto.
