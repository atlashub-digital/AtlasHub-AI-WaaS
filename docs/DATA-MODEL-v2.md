# Modelo de dados v2 — plataforma comercial e operacional

**Estado:** proposta para aprovação (Round 2) · **Base:** Supabase Postgres 17 · **Autor:** Claude Code
Complementa o modelo operacional do Round 1 (Prisma, schema `public`), que **se mantém** (não reescrever o trabalho do Codex). Os domínios novos vivem em schemas próprios.

## 1. Princípios transversais

| Tema | Regra |
|---|---|
| Tenancy | Todas as tabelas de negócio têm `tenant_id`. A própria AtlasHub é o tenant `atlashub` (*house tenant*): o seu CRM, as suas vendas e a Clara usam as mesmas tabelas que os clientes, o que permite à ROLE-002 operar o CRM de um cliente. |
| Isolamento | RLS ativo em todas as tabelas; o backend liga-se com a role `waas_runtime` (sem `BYPASSRLS`, sem DDL) e define `app.tenant_id` por transação. Operações de plataforma (operador AtlasHub) usam `app.scope = 'platform'` com políticas próprias e auditoria. `anon`/`authenticated` sem acesso direto: tudo passa pela API. |
| IDs | `uuid` v7 (ordenados no tempo) gerados na aplicação: índices compactos, particionamento e fusão entre regiões sem colisões. |
| Dinheiro | `amount_minor bigint` + `currency char(3)` ISO 4217. Nunca `float`. Taxas de câmbio guardadas no momento da fatura. |
| Tempo | `timestamptz` em UTC; `timezone` IANA no tenant, no contacto e na missão. |
| Multilíngue | Ver §9. Todo o texto apresentado tem tradução; o texto recebido de pessoas guarda a língua detetada. |
| Estados | Colunas `status` com `CHECK` e tabela de transições permitidas; cada transição gera um `core.audit_events`. |
| Dados pessoais | Minimizados, com base legal e consentimento por finalidade, retenção por tabela, exportação e eliminação por titular (RGPD/LGPD). |
| Eventos | Tabelas append-only (`*_events`, mensagens, webhooks, uso) particionadas por mês. Padrão *outbox* para efeitos externos. |
| Soft delete | Só em entidades comerciais (`archived_at`); dados pessoais são apagados ou anonimizados de verdade. |

## 2. Mapa de domínios

```
core ──── identidade, tenants, membros, regiões, locales, auditoria, feature flags
catalog ─ roles (colaboradores), packs, módulos, modelos de missão, planos, preços, i18n
crm ───── contactos, empresas, leads, importações, consentimentos, supressões, pipelines, oportunidades, atividades, cadências
concierge  Clara: sessões, mensagens, qualificação, base de conhecimento, custos de IA
commerce ─ propostas, encomendas, subscrições, acessos (entitlements), missões, alocações
billing ── contas de faturação, faturas, pagamentos, providers, eventos de webhook, reembolsos, impostos
public ─── (Round 1) operação: deployments, runs, approvals, usage, incidents, agenda sintética
```

Fluxo ponta a ponta:
`visita → Clara (sessão) → lead → qualificação → assessment → oportunidade → proposta → aceitação → encomenda → fatura → pagamento (webhook) → acesso + missão → deployment(s) sandbox → aceitação → ativo → uso → fatura recorrente`

## 3. `core`

| Tabela | Campos principais |
|---|---|
| `tenants` | id, slug, legal_name, kind (`platform`/`customer`/`partner`), status, region (`eu`/`br`/`us`), default_locale, timezone, default_currency, created_at |
| `user_profiles` | user_id (= `auth.users.id`), display_name, locale, timezone, is_platform_staff |
| `memberships` | tenant_id, user_id, role (`owner`,`admin`,`member`,`viewer`,`billing`), status, invited_by, joined_at |
| `locales` | code (BCP-47: `pt-PT`, `pt-BR`, `en`, `es`…), name, enabled, fallback_code |
| `feature_flags` | key, scope (`global`/`tenant`), tenant_id?, enabled, rules jsonb |
| `audit_events` | id, tenant_id, actor_type (`user`/`agent`/`system`/`operator`), actor_id, action, object_type, object_id, before/after jsonb mínimos, ip_hash, at — particionada por mês |

O modelo do Round 1 (`public."Tenant"`, `public."Membership"`) é ligado a `core.tenants` pelo mesmo `id` (migração de convergência na Fase B; até lá `public` continua a ser a fonte da operação).

## 4. `catalog` — o que vendemos

| Tabela | Campos principais |
|---|---|
| `roles` | id (`ROLE-001`…), slug, commercial_state (`concept`,`demo`,`pilot`,`ga`,`retired`), segments[], channels[], owner_user_id |
| `roles_i18n` | role_id, locale, name, tagline, description, deliverables[], limits[], faq jsonb |
| `pack_refs` | role_id, pack_id, version, sha, status — aponta para `atlas-agent-packs`, sem copiar |
| `modules` | id, role_id?, kind (`capability`,`channel`,`integration`,`volume`,`support`), requires[], incompatible_with[] |
| `modules_i18n` | module_id, locale, name, description |
| `mission_templates` | id, role_id, kind (`standard`/`modular`), default_duration (interval) ou `open_ended`, default_capacity jsonb (ex. 500 conversas/mês), included_modules[], optional_modules[], sla_profile_id, acceptance_tests[] |
| `mission_templates_i18n` | template_id, locale, name, objective, scope_in, scope_out |
| `sla_profiles` | id, coverage_hours, first_response_target, human_escalation_target, uptime_target — alvos, não promessas até homologação |
| `products` | id, kind (`mission`,`subscription`,`credit_pack`,`setup`,`addon`,`access`), ref_id (template/module/role), status |
| `products_i18n` | product_id, locale, name, description |
| `prices` | id, product_id, currency, pricing_model, billing_interval (`one_time`,`month`,`quarter`,`year`), amount_minor?, tiers jsonb?, usage_metric?, included_quantity?, overage_minor?, trial_days, valid_from/until, market (`PT`,`BR`,`*`), tax_behavior (`inclusive`/`exclusive`) |

`pricing_model`: `flat`, `per_seat` (por agente alocado), `per_unit` (por tarefa/conversa), `tiered`, `volume`, `package` (créditos), `mission_fixed`, `custom` (proposta). Preços só passam a `active` com aprovação do Founder (PRD: sem preços fictícios).

## 5. `crm` — captação, injeção e etapas comerciais

| Tabela | Campos principais |
|---|---|
| `companies` | tenant_id, name, domain, country, vat_id?, size_band, industry, locale |
| `contacts` | tenant_id, company_id?, full_name, email_norm (citext), phone_e164, preferred_locale, timezone, channel_prefs jsonb, owner_user_id |
| `consents` | tenant_id, contact_id, purpose (`contact_sales`,`marketing`,`whatsapp`,`data_processing`), lawful_basis (`consent`,`legitimate_interest`,`contract`), source, granted_at, withdrawn_at, evidence jsonb (texto exato mostrado, versão, locale, ip_hash) |
| `suppressions` | tenant_id, kind (`email`,`phone`,`domain`), value_hash, reason, at — verificada antes de qualquer contacto |
| `lead_sources` | tenant_id, kind (`clara`,`form`,`import`,`api`,`referral`,`event`,`partner`,`ads`), name, utm defaults |
| `leads` | tenant_id, contact_id, company_id?, source_id, status (`new`,`contacted`,`engaged`,`qualified`,`disqualified`,`converted`,`recycled`), score, fit jsonb (segmento, volume, sistemas, urgência), interest_role_ids[], locale, utm jsonb, first_touch_at, converted_opportunity_id? |
| `import_batches` | tenant_id, source_id, filename/endpoint, mapping jsonb, lawful_basis_declared, rows_total/valid/duplicate/rejected, status (`uploaded`,`validating`,`ready`,`importing`,`done`,`failed`), created_by |
| `import_rows` | batch_id, row_no, raw jsonb (retenção curta), normalized jsonb, errors[], dedupe_match_id?, outcome |
| `pipelines` / `pipeline_stages` | por tenant; stage: order, kind (`open`,`won`,`lost`), probability, exit_criteria; nomes em `pipeline_stages_i18n` |
| `opportunities` | tenant_id, lead_id, company_id, pipeline_id, stage_id, amount_minor, currency, expected_close, owner_user_id, lost_reason |
| `activities` | tenant_id, contact_id?, lead_id?, opportunity_id?, kind (`call`,`email`,`whatsapp`,`meeting`,`note`,`task`,`clara_session`), direction, status, due_at, done_at, outcome, actor (user/agent) — particionada |
| `sequences` / `sequence_steps` / `sequence_enrollments` | cadências multi-passo (canal, atraso, modelo i18n, **aprovação obrigatória** por passo), paradas por resposta, supressão ou retirada de consentimento |
| `message_templates` (+ `_i18n`) | canal, finalidade, variáveis permitidas; templates WhatsApp com estado de aprovação do provider |

Regras: deduplicação por `email_norm` / `phone_e164` / domínio dentro do tenant; importação **exige base legal declarada** e passa por `suppressions`; nenhum envio sem consentimento válido para a finalidade e canal; listas compradas ou *scraping* de dados pessoais ficam proibidos (Executive Brief).

## 6. `concierge` — Clara

| Tabela | Campos principais |
|---|---|
| `sessions` | id, tenant_id (`atlashub` ou o cliente que a usa), visitor_id (cookie pseudónimo), locale, page, utm jsonb, ai_disclosed_at, consent_id?, lead_id?, mode (`scripted`/`llm`), status, cost_minor, started/ended_at |
| `messages` | session_id, seq, author (`visitor`,`clara`,`human`), text (retenção curta), lang, intent?, safety_flags[], tokens_in/out, cost_minor — particionada |
| `qualifications` | session_id, answers jsonb (segmento, volume, canais, sistemas, urgência), recommended_template_ids[], confidence |
| `kb_articles` / `kb_articles_i18n` | fonte de verdade da Clara por locale; `embedding vector` para pesquisa semântica; estado `draft/approved`; só artigos aprovados são usados |
| `handoffs` | session_id, reason, assigned_user_id, status, sla_due_at |
| `ai_budgets` | scope (global/tenant/session), period, limit_minor, spent_minor, action_on_exceed (`scripted_fallback`,`handoff`) |

A Clara só fala do catálogo publicado e da base de conhecimento aprovada; nunca inventa preços nem resultados. Com orçamento esgotado ou erro do modelo volta ao modo roteirizado. Cria e enriquece `crm.leads` só depois do consentimento.

## 7. `commerce` — propostas, subscrições, acessos e missões

| Tabela | Campos principais |
|---|---|
| `quotes` | tenant_id (cliente), opportunity_id, status (`draft`,`sent`,`accepted`,`expired`,`rejected`), currency, valid_until, terms_version, accepted_by/at, signature_ref |
| `quote_lines` | quote_id, product_id, price_id, quantity, discount, mission_template_id?, modules[] |
| `orders` | tenant_id, quote_id?, status (`pending_payment`,`paid`,`fulfilling`,`fulfilled`,`cancelled`), totals |
| `subscriptions` | tenant_id, billing_account_id, status (`trialing`,`active`,`past_due`,`paused`,`cancelled`,`ended`), current_period_start/end, cancel_at, provider_subscription_ref? |
| `subscription_items` | subscription_id, price_id, quantity (ex. agentes alocados), usage_metric? |
| `entitlements` | tenant_id, key (`portal`, `simulator.premium`, `role.ROLE-001`, `credits.tasks`, `seats.agents`…), source (`subscription`,`order`,`grant`,`trial`), quantity?, valid_from/until, status — **o que o pagamento liberta** |
| `missions` | tenant_id, template_id, kind (`standard`/`modular`), objective, scope jsonb, modules[], capacity jsonb, starts_at, ends_at? , status, supervisor_user_id (humano AtlasHub), customer_owner_user_id |
| `mission_assignments` | mission_id, tenant_id, deployment_id (→ `public."Deployment"`), role_id, allocation (ex. 1 agente, 500 tarefas/mês), from/until |
| `mission_events` | transições, aceitação, pausas, renovação — particionada |

Estados da missão: `draft → proposed → accepted → provisioning → sandbox → acceptance → active ⇄ paused → completed | cancelled | terminated`.
Uma missão **standard** usa um `mission_template` fechado; uma **modular** junta módulos com validação de `requires`/`incompatible_with`. É assim que se modela a "alocação de colaboradores digitais a missões": o cliente contrata uma missão (objetivo, âmbito, duração ou contínua, capacidade, SLA), e a AtlasHub aloca um ou mais deployments e um supervisor humano.

## 8. `billing` — faturas, pagamentos e webhooks

| Tabela | Campos principais |
|---|---|
| `billing_accounts` | tenant_id, legal_name, vat_id, address jsonb, country, email, currency, locale, tax_exempt, provider_customer_refs jsonb |
| `tax_rates` | country, region?, kind, rate_bp (pontos base), valid_from/until |
| `invoices` | tenant_id, billing_account_id, number?, status (`draft`,`open`,`paid`,`void`,`uncollectible`), currency, subtotal/tax/total_minor, fx_rate?, due_at, period, **legal_document_ref** (emissor certificado: id, série, PDF, estado), locale |
| `invoice_lines` | invoice_id, product_id, price_id, description_i18n_snapshot, quantity, unit_minor, tax_rate_id, amount_minor, period |
| `payment_providers` | id (`stripe`, `pix_*`, `mbway_*`…), markets[], methods[], enabled, secret_ref (Vault, nunca o valor) |
| `payments` | tenant_id, invoice_id?, order_id?, provider_id, provider_payment_ref, method, status (`pending`,`authorized`,`succeeded`,`failed`,`refunded`,`disputed`), amount_minor, currency, fee_minor, paid_at |
| `refunds` / `disputes` | ligação ao pagamento, estado, valores |
| `webhook_events` | id, provider_id, provider_event_id, event_type, signature_valid, received_at, payload (cifrado, retenção curta), payload_sha256, status (`received`,`verified`,`processed`,`ignored`,`failed`), attempts, error — **UNIQUE (provider_id, provider_event_id)**, particionada |
| `dunning_attempts` | invoice_id, attempt_no, channel, at, outcome |

Processamento de webhook (idempotente, com fonte de verdade no provider):
1. `POST /v1/webhooks/payments/:provider` lê o *raw body*, verifica a assinatura com o segredo do Vault e a janela temporal, grava em `webhook_events` (`ON CONFLICT DO NOTHING`) e responde 2xx rápido.
2. O worker processa `received`/`verified`: **volta a consultar o pagamento na API do provider** (nunca confia só no payload), compara valor, moeda e referência.
3. Numa transação: atualiza `payments`, marca `invoices.paid`, ativa `entitlements`, avança `orders`, e grava `audit_events` + outbox (email de recibo, pedido de documento legal ao emissor certificado).
4. **Não** passa nenhuma missão nem deployment a `active`: cria a tarefa de provisionamento para o operador (gate humano).
5. Falhas: retry com backoff, DLQ e incidente; eventos fora de ordem resolvem-se pela consulta ao provider.

## 9. Multilíngue

- `core.locales` com cadeia de *fallback* (`pt-BR → pt-PT → en`).
- Conteúdo da plataforma em tabelas `*_i18n` com chave (`entity_id`, `locale`); a API devolve o locale pedido com fallback e indica o locale efetivo.
- Preferências: utilizador → contacto → tenant → `Accept-Language` → `en`.
- Mensagens de pessoas: guardadas no original com `lang` detetada; a Clara responde na língua do visitante quando o locale está ativo e tem KB aprovada; se não, passa a um humano ou a uma língua suportada, com aviso.
- Faturas, recibos e templates no locale da `billing_account`; formatos de número, moeda e data pelo locale (frontend com `Intl`).
- Frontend: rotas `/{locale}/…`, `hreflang`, catálogo e simuladores lidos por locale.

## 10. Segurança e RLS

```sql
-- padrão para todas as tabelas de tenant
alter table x enable row level security; alter table x force row level security;
create policy tenant_isolation on x for all to waas_runtime
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
create policy platform_operator on x for all to waas_runtime
  using (current_setting('app.scope', true) = 'platform');
```
- A API valida o JWT do Supabase (JWKS ES256), resolve a membership e abre uma transação com `set_config('app.tenant_id', …, true)`; o `app.scope = 'platform'` só é aceite para staff da AtlasHub com papel de operador, e é auditado.
- `waas_runtime`: `LOGIN`, sem `BYPASSRLS`, só `SELECT/INSERT/UPDATE/DELETE` nas tabelas da aplicação; DDL só pela role de migrações.
- Segredos (providers, integrações): Supabase Vault, referenciados por `secret_ref`.
- Testes negativos A/B obrigatórios para cada tabela nova (CI).

## 11. Escala

| Camada | Hoje (staging) | Crescimento |
|---|---|---|
| API/worker | containers numa VPS | sem estado → réplicas atrás de load balancer; depois orquestrador (ex. Kubernetes gerido) por região |
| Filas | Redis + BullMQ | Redis gerido com réplicas; filas por prioridade e por tenant (justiça) |
| Base de dados | Supabase pequeno (60 ligações) | pooler em modo transação; compute maior; réplicas de leitura; particionamento mensal dos eventos; arquivo frio |
| Regiões | uma | um projeto Supabase por região (`eu`, `br`, `us`), tenant fixado por `region`; diretório global mínimo (tenant → região) |
| n8n | instância única | *queue mode* com workers; instâncias por região |
| Frontend | Vercel | CDN global, páginas por locale com cache |
| Observabilidade | logs + `/ready` | OpenTelemetry, métricas por tenant/run, alertas, SLOs |

## 12. Fases de implementação
| Fase | Conteúdo | Saída verificável |
|---|---|---|
| A (G1) | Round 1 em Supabase, `waas_runtime`, RLS por tenant no caminho real, Auth Supabase | A/B negativos com utilizadores reais |
| B | `core` convergente, `catalog` + i18n, `crm`, captação pela Clara (roteirizada) | lead criado a partir da montra, com consentimento e em 3 línguas |
| C | `commerce` (quotes, orders, subscriptions, entitlements) + `billing` com provider em sandbox | webhook sandbox → fatura paga → acesso ativo; replay e evento duplicado sem efeito |
| D | `missions` + alocação a deployments; Clara com LLM atrás de feature flag | missão standard e modular provisionadas até `sandbox` com gate humano |
