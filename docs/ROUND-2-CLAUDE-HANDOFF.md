# ROUND 2 — MISSÃO OPERACIONAL MAX (Hermes + Codex)

**AtlasHub AI Workforce — Employee Factory**  
**Responsável:** MAX — agente Hermes, com motor de engenharia Codex  
**Data:** 2026-10-08  
**Estado:** instrução de execução; não certifica acessos, deploy ou integração  
**Projeto principal:** https://github.com/atlashub-digital/AtlasHub-AI-WaaS

> MAX é o responsável único pela condução técnica deste round: planeia, usa Codex para engenharia, utiliza ferramentas permitidas do Hermes para inspecionar e executar, testa, documenta, pede aprovação nos gates e reporta. Não depender de Claude Code, nem de PaperClip/atlas-si-os.

## 1. Mandato e critérios de sucesso
Tornar o vertical slice de ROLE-001 — Rececionista Digital — funcional em **staging remoto seguro**, integrado com os serviços existentes de AtlasHub, com registos auditáveis e operador humano para exceções. Preservar toda a operação atual.

**Não é objetivo:** implementar oito roles em produção, ativar canais ou clientes reais sem aprovação, migrar infraestrutura existente por iniciativa própria, prometer SLA ou fazer deploy direto em produção.

**Definition of Done Round 2:**
- VPS, dependências e riscos auditados com evidências sanitizadas.
- API e worker AI-WaaS em staging, health/ready, logs, filas, rollback e backups comprovados.
- Supabase Auth real e DB runtime de privilégio mínimo, contexto tenant/RLS verificados com testes negativos A/B.
- PACK-001 com ferramentas n8n integradas a calendário **de staging**, entrada por canal de testes autorizado, handoff e idempotência comprovados.
- T01–T14 / E01–E10 repetidos em remoto; matriz PASS/PARTIAL/FAIL honesta e go/no-go.
- Documentação, PRs e relatório publicados; sem mudança não autorizada de produção.

## 2. Contexto obrigatório antes de qualquer execução
Três repositórios integrados na main:
- https://github.com/atlashub-digital/AtlasHub-AI-WaaS — control plane, API, worker, docs e scripts.
- https://github.com/atlashub-digital/App.AtlasHub.Si — Clara, catálogo, assessment e portal.
- https://github.com/atlashub-digital/atlas-agent-packs — packs 001/002/003 e contratos.

PRs já integrados: AI-WaaS #6; App #1; Packs #1. **Não tratar relatórios antigos como prova do estado atual de branch.**

Ler antes de alterar:
1. `README.md`;
2. `docs/ROUND-1-DELIVERY-REPORT.md`;
3. `docs/02-TECHNICAL-BLUEPRINT.md`;
4. `docs/API.md`;
5. `docs/THREAT-MODEL.md`;
6. `docs/adr/001-staging-runtime-and-migrations.md`;
7. `docs/runbooks/OPERATIONS.md`;
8. `docs/03-ACCEPTANCE-AND-TESTS.md`;
9. `docs/05-RISKS-AND-DECISIONS.md`.

O Round 1 passou testes locais com dados sintéticos, mas não homologou ambiente remoto, Supabase real ou n8n/WhatsApp reais. O fluxo determinístico do ROLE-001 funciona localmente; não introduzir LLM sem justificação técnica.

## 3. Modo de trabalho MAX + Codex
**MAX/Hermes = agente executor/orquestrador da missão.** Mantém backlog, checkpoints, contexto, evidências, comunicações e controlo de gates. Usa ferramentas Hermes existentes para auditoria SSH/Docker (leitura inicialmente), GitHub e testes, apenas quando autorizadas e disponíveis.

**Motor Codex = executor de engenharia.** Usa Codex para analisar, alterar código, escrever testes, schemas, integrações e automação de deploy. Sempre por branches e PRs, com revisão e resultados de CI. O Codex não é uma infraestrutura separada nem recebe segredos por prompt; executa no ambiente e permissões autorizados do MAX.

**Política de autonomia:**
- Permitido sem confirmação adicional: ler repositórios, inspecionar serviços em modo não destrutivo, correr testes locais, preparar branches/PRs, atualizar documentação, usar ambientes de teste explicitamente identificados.
- Requer aprovação antes de agir: criação/alteração de recursos remotos, deploy staging se partilhar host/rede com produção, migrations em DB remota, criação de credenciais e regras DNS/reverse proxy/firewall, ligação a canais reais.
- Proibido sem autorização explícita de produção: reiniciar/parar serviços existentes; apagar bases/volumes/containers; alterar permissões de produção; expor APIs administrativas; mexer em gateways financeiros; enviar mensagens reais; alterar domínios e certificados existentes.

Segredos ficam num gestor de segredos ou variáveis protegidas já autorizadas; nunca em Git, logs, mensagens, relatórios ou prompts Codex. Uma ferramenta que o MAX não consiga aceder é bloqueio real, não motivo para inventar resultados.

## 4. Fases e gates

### G0 — Reconhecimento e baseline (read-only)
- Confirmar host autorizado e identidade SSH; auditar capacidade CPU/RAM/disco, Docker/Compose, portas, redes, volumes, backups e dependências; não fazer `docker inspect` com ambiente exposto.
- Mapear n8n, Hermes, Atendimento.Center, Chatwoot, Evolution, Redis, Caddy, Supabase/PostgreSQL e deploy Vercel.
- Verificar branches/main, CI e estado operacional do código.
- Produzir `docs/ROUND-2-INFRA-AUDIT.md`, riscos e topologia proposta com isolamento.
**Gate G0:** antes de mutações remotas, revisão do plano de deploy e do impacto sobre produção.

### G1 — Staging seguro e control plane
- Selecionar Docker network, host, domínios e volumes isolados; backups e rollback definidos.
- Criar `ai-waas-api` e `ai-waas-worker` com config externa e least privilege.
- Auditar Supabase antes de migrations, nunca apagar/recriar por iniciativa própria.
- Corrigir role runtime DB privilegiada: conceder escopo mínimo, tenant context confiável e RLS aplicável ao caminho real; comprovar A/B por testes.
- Testar Auth Supabase com utilizadores e memberships de teste, JWT/refresh, roles e revogação.
- Health, readiness, alertas, filas e incidentes.
**Gate G1:** ambiente demonstrável com logs e sem cross-tenant leakage.

### G2 — ROLE-001 e integrações
- Implementar 5 ferramentas do PACK-001 via n8n já existente (ou decisão técnica documentada se indisponível): `agenda.get_appointment`, `agenda.find_slots`, `agenda.update_status`, `waitlist.offer_slot` e `team.handoff`.
- Agenda **de teste** com dados sintéticos; autenticação e validação input/output, timeouts, idempotency key, grant por deployment, consentimento e anti-double-booking.
- Integrar Atendimento.Center/Chatwoot em inbox de teste autorizada; outbound WhatsApp apenas após autorização específica e conformidade com provedor.
- Conservar o executor determinístico; Hermes atua como orquestrador MAX e não necessariamente como LLM de cada conversa.
- Demonstrar confirmação, remarcação, exceção e pausa com trilha de auditoria.
**Gate G2:** E2E em staging sem dados reais de pacientes.

### G3 — Portal e operação
- Testar App.AtlasHub.Si com Auth Supabase real em preview isolado.
- Portal mostra apenas o tenant: deployments, runs, custos/uso, approvals, incidentes.
- Garantir expiração/escalonamento de approvals, retenção, cleanup, alertas para equipa e runbook de falhas.
- Medir custo operacional real da execução de staging (sem afirmar ROI comercial).

### G4 — Aceitação e handover
- Executar T01–T14, E01–E10, incluindo failures, restore, cross-tenant e custo.
- Publicar `docs/ROUND-2-DELIVERY-REPORT.md` com evidências, commits/PRs, versões, endpoints sanitizados, resultados e limitações.
- Recomendar GO/NO-GO; solicitar autorização explícita antes de pilotar com clientes reais.

## 5. Saída em cada checkpoint
Formato obrigatório:
1. **O que foi verificado** (evidência/link);
2. **O que foi alterado** (repo, branch, PR, ambiente);
3. **Testes** (PASS/PARTIAL/FAIL, não executados);
4. **Riscos e serviços afetados**;
5. **Bloqueios de acesso e aprovação requerida**;
6. **Próxima ação executável**.

## 6. Primeira ação do MAX
Ler contexto, conferir repositórios e PRs, iniciar inventário **somente leitura** nas VPS às quais tem acesso legítimo, sem varrer outros projetos nem tocar em produção. Devolver topologia factual e plano G1. Se não houver acesso, pedir apenas a concessão do acesso específico por canal seguro.

## Critério comercial final
A AtlasHub vende **serviço digital gerido**, não instalador de agentes. O operador AtlasHub deve conseguir iniciar, pausar, acompanhar, auditar e intervir no trabalho de cada colaborador digital. Clara apresenta a oferta; a infraestrutura executa; MAX conduz a engenharia de implementação neste round.
