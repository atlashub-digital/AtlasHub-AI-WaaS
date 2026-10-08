# Round 1 — relatório de implementação e evidências

**Decisão: NO-GO para homologação/comercialização. Round parcialmente implementado e validado em staging local sintético; requisitos remotos e alguns componentes permanecem pendentes.** Nenhuma produção, VPS, agente Hermes ou projeto Supabase remoto foi modificado.

Data de evidência: 07/10/2026, America/Sao_Paulo; timestamp de benchmark 2026-10-08T02:27:36.725Z. Código principal verificado: `b2f4eb520fb967ed6180a540bafbd859190dee22`; frontend `6f18d92ea257c980034d76e6aa6c8ec3301444d6`; packs `3936a4da47fb76073d1e9c55c7af590c22859f3c`. Alterações seguintes são relatório/benchmark/parametrização do destino restore. Branch `feat/round-1-staging` em cada checkout.

## Entrega concreta

- Backend NestJS/TypeScript: JWT validado, memberships, criação de tenants por owner, provisionamento sandbox por operador, versão/hash de pack fixados, transições auditadas, inbound HMAC, consulta de runs/approvals/usage/incidents e pausa.
- Worker BullMQ/Redis: outbox reconciliado, execução determinística ROLE-001, consentimento persistido, schemas/grants, confirmação e remarcação com aprovação, agenda PostgreSQL sintética stateful, reserva atómica, optimistic concurrency, efeito idempotente, quota de ações, retries/DLQ e reprocessamento pelo operador.
- Frontend Next existente preservado: Clara determinística comunica serviço gerido, catálogo estratégico de oito roles distingue demos/planeados, três simuladores, assessment com consentimento, portal server-side com cookie/JWT e decisões humanas. Não há LLM ou canal real.
- PACK-002 e PACK-003 em demo, guardrails de aprovação, dados fictícios e testes executáveis; PACK-001 e schema v1 preservados. Catálogo v0.2.0.
- Contratos OpenAPI 3.1, tipos TypeScript gerados, migrations SQL/checksums, Compose local e imagem Node 22, bootstrap repetível, ADR, ameaça/licenças/runbooks e workflow GitHub Actions.

## Resultados observados

| Verificação | Resultado local |
|---|---|
| Packs validate + test + build | PASS: 3 packs + template; 5 testes |
| Frontend npm ci/test/lint/typecheck/build | PASS: 10 testes; três páginas simulador e rotas portal/assessment/login compiladas |
| Backend build + unit/connector | PASS: 5 testes, incluindo assinatura, TLS/allowlist, output inválido, indisponibilidade e timeout de servidor HTTP sintético |
| Integração API/worker/DB/Redis | PASS: 14 testes contra containers Node 22, agenda stateful, tenants A/B |
| Segurança DB | PASS: 2 testes; FK composta rejeita referência cruzada; role não privilegiada não lê tabelas privadas |
| Browser Chromium | PASS: redirect anónimo, três demos, assessment com consentimento, portal com JWT sintético e negação A→B; login real Supabase não testado |
| DB outage/readiness | PASS: readiness 503 durante paragem do Postgres local, 200 após reinício |
| Backup/restore | PASS: dump restaurado em destino separado; primeira prova 17 runs, prova final 38 runs em waas_restore_round1; origem preservada |
| Repetibilidade | PASS: cloud-install.sh completo executado; migrations reaplicadas sem duplicação; fixtures resetadas explicitamente e E2E novamente executados |
| Docker | PASS: imagem offline construída a partir de cache npm íntegro; API/worker arrancaram com rootfs read-only, cap_drop ALL e loopback; build online falhou por DNS EAI_AGAIN no builder |
| Benchmark | 20 pedidos signed inbound sintéticos, concorrência 1: p50 17,67ms, p95 28,59ms, máximo 67,97ms; mede admissão, não conclusão do worker nem SLA |
| GitHub Actions remoto | NÃO EXECUTADO: push/REST bloqueados; YAML guardado não equivale a CI verde |

36 testes automatizados contados (5 packs +10 frontend +5 backend +14 integração +2 DB), sem falhas/skips no conjunto final observado, mais browser/readiness/restore funcionais. Evidências sanitizadas em `docs/evidence/` e outputs locais ignorados em `artifacts/`; screenshot `artifacts/portal-staging.png` contém só dados sintéticos.

## Matriz de aceitação original

| ID | Estado/evidência e limite |
|---|---|
| T01 | PASS local: validate/test/build, schema v1, três packs |
| T02 | PASS local: instalação frozen, testes/lint/typecheck/build |
| T03 | PARCIAL: Nest/Prisma/Postgres/Redis e migrations up repetíveis; rollback documentado por restore, CLI migrate/down nativo não certificado |
| T04 | PASS local JWT/membership/roles e negativos A/B; autenticação Supabase real e RLS contextual da ligação backend ainda pendentes |
| T05 | PASS local: assinatura inválida/stale rejeitadas, duplicado sem segundo efeito |
| T06 | PARCIAL: falha da agenda → 3 retries/DLQ/incidente/retry controlado; timeout/output n8n em fixture HTTP. n8n real não integrado |
| T07 | PASS no runtime local: grant desativado bloqueia execução, schemas strict, tool desconhecida negada, eventos sem texto clínico; gateway externo real pendente |
| T08 | PASS local: pausa suspende novas tarefas e mantém consulta de histórico |
| T09 | PASS no executor determinístico: tenant/horário não viram autoridade; não há LLM a testar |
| T10 | PASS local: injection não executa ferramenta proibida nem revela segredo |
| T11 | PASS local outage/readiness/restore separado; backup cifrado/remoto e rollback de VPS não exercitados |
| T12 | PASS portal com JWT sintético e A/B; login/refresh real Supabase e preview autenticado remoto pendentes |
| T13 | PASS browser: demo fictícia/serviço gerido e consentimento; consentimento/base legal contratual continua decisão externa |
| T14 | PARCIAL: usage por mutação sintética, quota e threshold; custos LLM/canal/infra, orçamento diário/run real e alertas externos não medidos |

E01–E10 passaram **no fluxo determinístico local e calendário sintético**: confirmação única; slots de DB/remarcação aprovada; zero slots/handoff; texto clínico/handoff; ausência de consentimento bloqueia; disputa por slot sem dupla reserva; duplicado sem efeito duplicado; fallback determinístico/unknown preserva mensagem; isolamento A/B; pausa. E08 não simula falha de Hermes remoto porque Hermes não é dependência deste fluxo. Estes resultados não certificam integrações nem constituem waiver dos critérios remotos.

## Bloqueios externos e ação precisa

1. GitHub: ls-remote funciona, push dry-run foi recusado (403) à identidade `nexflowx-hub`. Organização alvo confirmada pelo utilizador: `atlashub-digital`. A sessão não pode trocar a conexão OAuth da plataforma. Conectar uma identidade com escrita nos três repos nas definições; depois repetir push, abrir PRs e observar Actions. Descrições de PR estão guardadas, mas **não existem PRs remotos desta entrega**.
2. Supabase `aakdyumavlzgyklbrsrw`: URL registado; sem credentials/bindings ativos. HTTPS bloqueado pela política atual. CLI `codex mcp add supabase --url ...` solicitado pelo utilizador falhou porque CODEX_HOME é read-only. É necessário anexar/autenticar o MCP pelo ambiente e disponibilizar conexão administrativa/DB segura. Reconstrução foi autorizada, mas depende de auditoria de schemas/dependências e backup recuperável; nenhum delete foi executado.
3. VPS: SSH à porta fornecida recusou conexão. Disponibilizar rota/firewall/acesso e host-key confiável no ambiente; não enviar chaves/senhas no chat. Inventariar os agentes Hermes, n8n, redes e volumes antes de instalar o backend, preservando ecossistema existente.
4. Draft cloud: `install_script`, `start_skill`, domínios adicionais e requisitos não secretos foram guardados com status saved. Rever/guardar nas definições e publicar para ativar configuração/snapshot. Isto não executa scripts nem certifica restauração em outra task; commits ainda só locais.

## Componentes ainda não operacionais / backlog obrigatório

- n8n transport testado mas não ligado ao executor; nenhum workflow real PACK-001, Chatwoot/WhatsApp/outbound, Hermes, CRM ou email homologado. Não promover ROLE-001 a pilot-ready real.
- DB runtime least privilege e RLS por tenant no backend: a conexão local proprietária contorna RLS. Default deny para clientes diretos não substitui esse requisito.
- Login/refresh Supabase real, preview/deploy frontend, canal autorizado, políticas comerciais/privacidade, responsáveis de suporte e revisão de licença n8n/Redis.
- Subscription/ServicePlan/propostas comerciais persistidas, revogação/exportação/eliminação de tenant, interface de provisionamento/operations completa, notifications e dashboards Prometheus não implementados.
- Expiração/escalada/limpeza automáticas de approvals e inputs, retenção acordada e orçamento LLM/canal/infra não implementados; quota atual conta ações de agenda, não todas as mensagens.
- Integração do gateway externo deve validar output e idempotência do calendário real antes de uso; aprovações externas não são automaticamente confiáveis. Revisão de segurança independente necessária.
- OpenAPI tem request schemas principais/tipos gerados; response schemas/client SDK completos e validação contratual adicional pendentes.

Não há waiver assinado e os requisitos originais mantêm-se. Próximo gate: desbloquear acessos, auditar/baseline remoto, endurecer DB/contexto, integrar workflow no ecossistema existente, repetir matriz em staging remoto/CI e só depois emitir decisão de homologação.
