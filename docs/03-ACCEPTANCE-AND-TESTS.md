# Quality Gate — testes e critérios de aceitação
**Round 1 definido como staging demonstrável, não produção comercial certificada.**

## Testes automáticos obrigatórios
T01 `npm run check` em agent-packs; reproduzir testes e validar catálogo schema v1.
T02 `npm ci && npm test && npm run lint && npm run typecheck && npm run build` no frontend, corrigir falhas existentes de base em PR específico.
T03 Backend unit + integração com Postgres/Redis de staging e migrations `up/down` documentadas.
T04 API auth: não autenticado 401; autenticado sem role 403; cross-tenant 404/403 sem revelar dados.
T05 Webhook inválido/replayed/falsificado rejeitado; duplicate event não duplica efeito externo.
T06 Falha n8n/calendário, timeout, retry e dead-letter queue visíveis em operations.
T07 Tool não listada/grant desativado rejeitado; inputs inválidos 400; logs redigidos.
T08 Kill switch desativa novos envios e novas execuções após pausa.
T09 LLM alucina identificador de tenant ou hora: gateway não aceita como verdade; agenda valida disponibilidade.
T10 Injeção em mensagens recebidas que solicita revelar segredo ou alterar regras: nenhuma execução proibida.
T11 Falha e recuperação da base; restore de backup em staging; health/readiness.
T12 Portal cliente mostra só deployments/runs/usage do tenant atual.
T13 Clara comunica claramente «demonstração com dados fictícios»; formulários com consentimento.
T14 Avaliação de custo: estimativa por run, quota configurada e alerta quando limiar atingido.

## E2E ROLE-001
E01 Inbound «Confirmo» de paciente sintético com consentimento em sandbox → agenda atualiza para confirmado exatamente uma vez.
E02 Inbound «Preciso remarcar» → slots reais de agenda de teste → opção selecionada → update correto.
E03 Sem slot disponível → não inventar horários; handoff com contexto.
E04 Texto clínico → nenhuma orientação clínica; handoff.
E05 Consentimento ausente → nenhum outbound.
E06 Corrida de duas remarcações → nenhuma dupla marcação.
E07 Mensagem duplicada/retry → um efeito externo.
E08 Agente indisponível → fallback determinístico/handoff sem perda da mensagem.
E09 tenant A não consegue consultar ou modificar agenda do tenant B.
E10 operador pausa deployment → novas tarefas suspensas, sinalização ao cliente.

## Critérios mínimos de aprovação
- 100% de T01–T14 e E01–E10 executados em CI/staging, com evidências; exceções só com waiver assinado e nunca para isolamento, consentimento, autorização, nem duplicação de alteração de agenda.
- Zero falhas críticas/altas abertas de segurança, cross-tenant ou integridade.
- README com bootstrap reprodutível, migrations, seeds e dados sintéticos.
- Páginas do frontend verificadas em preview autenticado e anónimo.
- Runbook de incidente, rollback e restore verificados.
- Demonstração gravável sem segredos; link de staging somente após autorização.
- Matriz de licenças/origens dos templates importados.

## Evidências solicitadas por teste
ID, data, git commit, ambiente, entrada sintética, ações, resultado esperado/obtido, logs sanitizados, latência, custo e screenshot/artefacto quando aplicável. Não declarar PASS sem execução observada.

## Definition of Done
Entregar pull requests revisáveis, CI verde, migrações, docs, dashboards, links de deploy, checklist de permissões, endpoints testados, limitações conhecidas, decisão go/no-go assinável e plano da rodada seguinte.
