# Blueprint técnico implementável — AI-WaaS
**Versão 1.0 · ADRs e design de Round 1**

## Decisões iniciais
- Backend: NestJS/TypeScript em `AtlasHub-AI-WaaS/services/api`; worker em `services/worker`.
- Migrations/schema: Prisma + PostgreSQL (apenas com DB de staging primeiro). Avaliar compatibilidade com schemas já em uso antes de aplicar qualquer migration.
- Fila Redis/BullMQ; observabilidade estruturada; métricas Prometheus-compatible ou alternativa existente.
- Frontend: manter Next 16 e código do simulador em `App.AtlasHub.Si`, adicionar área autenticada por features.
- Runtime: fluxo determinístico primeiro; Hermes apenas onde classificação de intenção não for coberta com regras, com saída tipada e tool gateway.
- n8n permanece privado; cada chamada recebe identidade do deployment assinada pelo backend; n8n não decide identidade por parâmetros do utilizador.
- Deployment inicial em Docker Compose staging, com health/readiness e limites de recursos; Vercel frontend.

## Monorepo mínimo sugerido
```
AtlasHub-AI-WaaS/
  services/api/src/{auth,tenants,roles,deployments,ingest,runs,tools,approvals,usage,ops}
  services/worker/src/{jobs,connectors,executors}
  packages/contracts/{openapi,events,tool-schemas}
  packages/db/{prisma,migrations,seed}
  infra/{compose,proxy,observability}
  tests/{unit,integration,e2e,security}
  docs/{runbooks,adr,...}
```
Permitir simplificações pragmáticas desde que responsabilidades permaneçam explícitas.

## Entidades e colunas mínimas
`tenants(id,slug,name,status,created_at)`
`memberships(id,tenant_id,user_id,role,status)`
`roles(id,slug,name,commercial_state)`
`pack_releases(id,pack_id,version,sha,manifest_snapshot,status)`
`deployments(id,tenant_id,role_id,pack_release_id,state,config_json,limits_json,created_at,updated_at)`
`tool_grants(id,tenant_id,deployment_id,tool_id,enabled,policy_json)`
`channel_bindings(id,tenant_id,deployment_id,provider,inbox_external_id,status)`
`task_runs(id,tenant_id,deployment_id,external_event_id,idempotency_key,correlation_id,state,started_at,finished_at,cost_estimate)`
`task_events(id,tenant_id,run_id,type,safe_payload_json,created_at)`
`approvals(id,tenant_id,run_id,requested_action,safe_context_json,state,assignee_id,expires_at,resolved_at)`
`usage_records(id,tenant_id,run_id,metric,quantity,unit,estimated_cost,currency)`
`incidents(id,tenant_id,deployment_id,severity,state,opened_at,closed_at,owner_id)`
`audit_events(id,tenant_id,actor_type,actor_id,action,object_type,object_id,at,ip_hash)`
`integration_connections(id,tenant_id,provider,secret_ref,status,created_at)`
Índices: tenant_id em todas as tabelas multi-tenant; unique(deployment_id,idempotency_key); índices em run/state/time. Segredos fora do banco de aplicação, guardar apenas secret_ref. Definir exclusão/retenção por categoria.

## Segurança e identidade
- Separar `tenant_user`, `tenant_admin`, `atlas_operator`, `atlas_engineer`, `atlas_owner`.
- Não aceitar tenant_id de um pedido externo sem reconciliar com autenticação/canal ligado.
- Supabase RLS e grants mínimos nas tabelas expostas; service role apenas server-side e usado com cautela, porque contorna RLS.
- Gate de permissões implementado no backend **e** na DB; testes com tenants A/B.
- Webhooks: assinatura/HMAC ou método oficial do provedor, replay protection e timestamps.
- Prompt injection: tratar texto recebido como dados; nunca elevar instruções do cliente às políticas de tools.
- Secret manager; não enviar tokens em prompts, logs, traces ou dados de simulação.
- Campos sensíveis de contacto e agenda com mascaramento, minimização e retenção definida.
- Registar consentimento/base legal por finalidade; não usar dados sensíveis em demo.

## Contrato de execução
```json
{"event_id":"evt_demo_001","source":"chatwoot-sandbox","channel_binding_id":"ch_demo","timestamp":"2026-10-07T15:00:00Z","payload":{"conversation_ref":"synthetic-123","intent_text":"Confirmar a consulta"}}
```
O backend resolve tenant/deployment pelo channel binding autenticado, calcula idempotency key, regista run e enfileira job. O worker valida política + quota. Tool gateway usa (tenant, deployment, tool) grant autorizado, tipa inputs/outputs via schemas e invoca n8n privado. Audita resposta e aplica política de handoff.
**Não** confiar em tenant_id vindo de texto do agente.

## Contrato da ferramenta
Nome definido no pack: `agenda.get_appointment`, `agenda.find_slots`, `agenda.update_status`, `waitlist.offer_slot`, `team.handoff`.
Cada tool: `inputSchema`, `outputSchema`, `timeoutMs`, `idempotencyMode`, `requiresApproval`, `requiredScopes`, `riskTier`, `bindingRef`. Adaptar pack manifest por compatibilidade de schema; não destruir V0.

## Política ROLE-001
- Enviar lembretes **somente com autorização e regras de canal validadas**; não assumir que o WhatsApp permite mensagens arbitrárias fora da janela.
- Confirmar agenda apenas se registo existir e pertencer ao tenant; escrever mudança com optimistic concurrency/version check e idempotência.
- Remarcação: reservar/confirmar atomicamente quando backend de agenda suportar; senão submeter à aprovação humana para evitar dupla reserva.
- Sintomas, urgências e pedido clínico: bloquear resposta profissional e encaminhar para humano; para urgências, apresentar orientação genérica de procurar serviços de emergência, sem triagem clínica autónoma.
- Lista de espera opcional e por adesão consentida; não enviar oferta a destinatários não autorizados.

## API baseline
`GET /health`; `GET /ready`; `GET /v1/roles`; `POST /v1/assessments`; `GET /v1/tenants/:id/deployments`; `POST /v1/deployments`; `POST /v1/deployments/:id/transition`; `POST /v1/inbound/:provider`; `GET /v1/runs`; `GET /v1/runs/:id`; `GET /v1/approvals`; `POST /v1/approvals/:id/decide`; `GET /v1/usage`; `POST /v1/deployments/:id/pause`; `GET /v1/ops/incidents`.
Especificar OpenAPI 3.1 e gerar clientes tipados. Idempotency-Key em endpoints mutantes que afetam sistemas externos.

## Migração da arquitetura existente
Não copiar código do simulador nem métricas. `atlas-agent-packs` continua a gerar `dist/catalog.json`, consumido pela app. O control plane usa referência de pack + release SHA fixado e snapshot validado em import server-side. Criar contrato de versão verificável entre front/backend e reportar mismatch antes de deployment.
