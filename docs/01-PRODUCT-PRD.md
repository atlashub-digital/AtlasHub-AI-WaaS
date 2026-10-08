# PRD — Employee Factory / Managed Digital Employees
**Versão 1.0 · Fonte de verdade de requisitos de produto**

## Personas e jornadas
**Lead:** entra no App/Clara, descreve necessidade, vê demo claramente fictícia, indica volume e sistemas, pede assessment; não fornece credenciais nem dados sensíveis durante demo.
**Comprador:** recebe diagnóstico e proposta com scope, limites, canais, franquia, SLA, preço e tratamento de dados; aprova o contrato.
**Admin cliente:** autentica-se, vê apenas seu tenant, acompanha serviço, configura dados de negócio permitidos, revê tarefas e autoriza determinadas ações; não edita workflows n8n nem configura ferramentas arbitrárias.
**Operador AtlasHub:** cria tenants, aprova provisionamento, acompanha falhas, escala e interrompe automações.
**Engenharia AtlasHub:** publica packs assinados/versionados, configura conectores e controla rollout, rollback e incidentes.

## Objetos essenciais
`Pack`: artefacto técnico imutável (`pack_id`, `version`, `sha`, `capabilities`, `tool_contracts`, `guardrails`).
`Role`: produto vendido (`role_id`, texto de função, segmentos, job-to-be-done, canais, limites, deliverables).
`ServicePlan`: preço e franquia aprovados, SLA, suporte, consumo excedente.
`Tenant`: cliente empresarial, seus utilizadores e contratos.
`Deployment`: instanciação exclusiva do Role/Pack com configuração, tool grants e canais de um tenant.
`Run`: execução auditável de tarefa com resultado, custo, tempo e event trail.
`Approval/Handoff`: decisão humana e sua trilha.
`Subscription`: referência comercial; não equivale à ativação técnica automática.

## Fluxos
F01 Lead → simulação → assessment → proposta (Clara/CRM): identificação da origem, consentimento, solicitação de contacto.
F02 Operador → tenant → subscription → deployment sandbox → testes de aceitação → aprovado → ativo.
F03 Mensagem inbound assinada/verificada → resolução de tenant por canal → idempotência → política → task run → n8n/tool → resultado → resposta → auditoria/usage.
F04 Exceção → aprovação/handoff → notificações → decisão humana → retomar/cancelar com timeout.
F05 Pausa → impedir novas execuções e envios, terminar filas de forma segura, permitir consulta de histórico.
F06 Rescisão → revogar acesso, tokens e canais, exportar dados permitidos e eliminar segundo retenção acordada.

## Requisitos funcionais (prioridade MUST no Round 1)
FR-01 Catálogo `GET /v1/roles` com estado comercial demo/pilot/ga independente do estado do pack.
FR-02 Tenant e utilizadores com permissões; auth Supabase/JWT validado server-side.
FR-03 Deployment com estados `draft,sandbox,acceptance,pilot,active,paused,suspended,terminated`; transições auditadas.
FR-04 Pack pinning de versão/sha, configuração validada por schema e grants por ferramenta.
FR-05 API para ingest de eventos e execução de workflow com `idempotency_key` e `correlation_id`.
FR-06 Persistência de Run, TaskEvent, UsageRecord, Approval e Incident.
FR-07 Kill switch por tenant/deployment, quotas, timeouts, retries e dead-letter queue.
FR-08 Approvals/handoffs com tarefas e responsável humano; default deny.
FR-09 Admin interno pode consultar status, reprocessar com controle e exportar relatório.
FR-10 Portal cliente: status, resumo de atividades, tarefas aguardando aprovação e limites de consumo.
FR-11 Clara apresenta serviço **operado pela AtlasHub** e diferencia demo de execução real.
FR-12 Logs sem credenciais nem PII desnecessária; documentação de APIs e erros.

## SHOULD
SH-01 Conector calendário sandbox, Chatwoot sandbox, notificações e relatórios por período.
SH-02 Perfis ROLE-002/003 demonstráveis com casos de teste; sem integração live.
SH-03 Estimativa real de custos LLM/canal/workflow por tenant, granular por run.

## WON'T Round 1
Construtor de agentes para clientes; acesso cliente ao editor n8n; billing automático; ligações ERP genéricas; 8 agentes de produção; pagamentos; ações financeiras; decisões clínicas; auto-self-modification; uso de PaperClip.

## Requisitos não funcionais (alvos de validação, não SLAs contratados)
NFR-01 Zero cross-tenant reads/writes em testes automatizados negativos.
NFR-02 100% das mutações externas com autenticação, autorização e idempotência.
NFR-03 100% das tools com allowlist por deployment, schema, timeout e registo de execução.
NFR-04 Kill switch bloqueia novas ações antes do próximo processamento.
NFR-05 Restore testado em staging; versões e migrations reversíveis quando possível.
NFR-06 P95 de resposta do gateway medido com teste de carga e baseline documentada (definir meta após medição).
NFR-07 Orçamentos e alertas: limites configuráveis por execução, dia e tenant.
NFR-08 Porta de admin nunca exposta sem autenticação; comunicação TLS/privada.

## Catálogo comercial
Oito roles em `MVP-8-DIGITAL-EMPLOYEES.md`. Primeiro piloto ROLE-001. Preços e economia **TBD** até benchmark de custos e aprovação comercial. Nunca exibir números fictícios como resultado realizado.

## Decisões que o Codex NÃO inventa
Marca/identidade final, política contratual, preços finais, horários humanos de suporte, número real de WhatsApp, credenciais, base legal ou garantia de uptime. Registar blockers; implementar defaults seguros e configuração externa.
