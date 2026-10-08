# Colaboradores digitais — registo técnico

> Gerado por `scripts/roles-doc.mjs` a partir de `packages/roles`. Não editar à mão.

Todos os colaboradores correm no mesmo motor: inbound assinado → tenant pelo canal → classificação de intenção (regras pt/en/es; IA opcional só para mensagens não reconhecidas) → playbook determinístico → gateway de tools (grant + schema + política) → sistema do cliente (sandbox em staging, ou n8n por tool) → aprovação humana quando exigida → auditoria, uso e custo.

| Role | Pack | Intenções | Tools com aprovação | Tools proibidas |
|---|---|---|---|---|
| ROLE-001 Rececionista Digital | PACK-001 | confirm, reschedule, clinical, unknown | agenda.update_status (remarcação) | aconselhamento clínico |
| ROLE-002 Assistente Comercial | PACK-002 | opt_out, meeting, qualify | calendar.book_meeting, message.send_followup | — |
| ROLE-003 Secretária Administrativa | PACK-003 | meeting, finance, general | calendar.hold | mail.send |
| ROLE-004 Consultor Imobiliário Digital | PACK-004 | negotiate, visit, search | visit.schedule | offer.submit |
| ROLE-005 Assistente E-commerce | PACK-005 | refund, return, status, shipping | refund.request | payment.refund_execute |
| ROLE-006 Assistente de Marketing | PACK-006 | report, schedule, draft, research | post.schedule | post.publish |
| ROLE-007 Assistente Financeiro Administrativo | PACK-007 | transfer, reconcile, reminder, register | reminder.send | payment.transfer |
| ROLE-008 Assistente de RH | PACK-008 | decision, interview, apply, faq | interview.schedule | candidate.rank |

## ROLE-002 — Assistente Comercial (PACK-002 `sales-assistant` v0.2.0)

Línguas: pt-PT, pt-BR, en, es.

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `crm.upsert_lead` | automática | sim (idempotente por run) | `POST /webhook/sales-assistant/crm-upsert_lead` |
| `crm.log_activity` | automática | sim (idempotente por run) | `POST /webhook/sales-assistant/crm-log_activity` |
| `crm.suppress` | automática | sim (idempotente por run) | `POST /webhook/sales-assistant/crm-suppress` |
| `calendar.find_slots` | automática | não | `POST /webhook/sales-assistant/calendar-find_slots` |
| `calendar.book_meeting` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/sales-assistant/calendar-book_meeting` |
| `message.send_followup` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/sales-assistant/message-send_followup` |
| `team.handoff` | automática | não | `POST /webhook/sales-assistant/team-handoff` |

Tools concedidas no provisionamento: `crm.upsert_lead`, `crm.log_activity`, `crm.suppress`, `calendar.find_slots`, `calendar.book_meeting`, `message.send_followup`, `team.handoff`.

## ROLE-003 — Secretária Administrativa (PACK-003 `administrative-secretary` v0.2.0)

Línguas: pt-PT, pt-BR, en, es.

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `mail.read` | automática | não | `POST /webhook/administrative-secretary/mail-read` |
| `mail.label` | automática | sim (idempotente por run) | `POST /webhook/administrative-secretary/mail-label` |
| `mail.draft_reply` | automática | sim (idempotente por run) | `POST /webhook/administrative-secretary/mail-draft_reply` |
| `mail.send` | ❌ proibida | sim (idempotente por run) | — |
| `calendar.find_slots` | automática | não | `POST /webhook/administrative-secretary/calendar-find_slots` |
| `calendar.hold` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/administrative-secretary/calendar-hold` |
| `brief.create` | automática | sim (idempotente por run) | `POST /webhook/administrative-secretary/brief-create` |
| `team.handoff` | automática | não | `POST /webhook/administrative-secretary/team-handoff` |

Tools concedidas no provisionamento: `mail.read`, `mail.label`, `mail.draft_reply`, `calendar.find_slots`, `calendar.hold`, `brief.create`, `team.handoff`.

## ROLE-004 — Consultor Imobiliário Digital (PACK-004 `real-estate-consultant` v0.1.0)

Línguas: pt-PT, pt-BR, en, es.

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `property.search` | automática | não | `POST /webhook/real-estate-consultant/property-search` |
| `property.get` | automática | não | `POST /webhook/real-estate-consultant/property-get` |
| `lead.capture` | automática | sim (idempotente por run) | `POST /webhook/real-estate-consultant/lead-capture` |
| `visit.schedule` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/real-estate-consultant/visit-schedule` |
| `offer.submit` | ❌ proibida | sim (idempotente por run) | — |
| `team.handoff` | automática | não | `POST /webhook/real-estate-consultant/team-handoff` |

Tools concedidas no provisionamento: `property.search`, `property.get`, `lead.capture`, `visit.schedule`, `team.handoff`.

## ROLE-005 — Assistente E-commerce (PACK-005 `ecommerce-assistant` v0.1.0)

Línguas: pt-PT, pt-BR, en, es.

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `order.lookup` | automática | não | `POST /webhook/ecommerce-assistant/order-lookup` |
| `faq.answer` | automática | não | `POST /webhook/ecommerce-assistant/faq-answer` |
| `return.create` | automática | sim (idempotente por run) | `POST /webhook/ecommerce-assistant/return-create` |
| `refund.request` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/ecommerce-assistant/refund-request` |
| `payment.refund_execute` | ❌ proibida | sim (idempotente por run) | — |
| `team.handoff` | automática | não | `POST /webhook/ecommerce-assistant/team-handoff` |

Tools concedidas no provisionamento: `order.lookup`, `faq.answer`, `return.create`, `refund.request`, `team.handoff`.

## ROLE-006 — Assistente de Marketing (PACK-006 `marketing-assistant` v0.1.0)

Línguas: pt-PT, pt-BR, en, es.

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `research.collect` | automática | não | `POST /webhook/marketing-assistant/research-collect` |
| `post.draft` | automática | sim (idempotente por run) | `POST /webhook/marketing-assistant/post-draft` |
| `post.schedule` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/marketing-assistant/post-schedule` |
| `post.publish` | ❌ proibida | sim (idempotente por run) | — |
| `report.generate` | automática | não | `POST /webhook/marketing-assistant/report-generate` |
| `team.handoff` | automática | não | `POST /webhook/marketing-assistant/team-handoff` |

Tools concedidas no provisionamento: `research.collect`, `post.draft`, `post.schedule`, `report.generate`, `team.handoff`.

## ROLE-007 — Assistente Financeiro Administrativo (PACK-007 `finance-assistant` v0.1.0)

Línguas: pt-PT, pt-BR, en, es.

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `invoice.register` | automática | sim (idempotente por run) | `POST /webhook/finance-assistant/invoice-register` |
| `reconcile.match` | automática | sim (idempotente por run) | `POST /webhook/finance-assistant/reconcile-match` |
| `reminder.send` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/finance-assistant/reminder-send` |
| `payment.transfer` | ❌ proibida | sim (idempotente por run) | — |
| `team.handoff` | automática | não | `POST /webhook/finance-assistant/team-handoff` |

Tools concedidas no provisionamento: `invoice.register`, `reconcile.match`, `reminder.send`, `team.handoff`.

## ROLE-008 — Assistente de RH (PACK-008 `hr-assistant` v0.1.0)

Línguas: pt-PT, pt-BR, en, es. Atributos removidos à entrada: 33 (ex.: age, idade, edad, birth_date, data_nascimento, gender).

| Tool | Política | Efeito externo | Rota n8n (quando ativada por deployment) |
|---|---|---|---|
| `application.register` | automática | sim (idempotente por run) | `POST /webhook/hr-assistant/application-register` |
| `faq.answer` | automática | não | `POST /webhook/hr-assistant/faq-answer` |
| `interview.find_slots` | automática | não | `POST /webhook/hr-assistant/interview-find_slots` |
| `interview.schedule` | **aprovação humana** | sim (idempotente por run) | `POST /webhook/hr-assistant/interview-schedule` |
| `candidate.rank` | ❌ proibida | não | — |
| `team.handoff` | automática | não | `POST /webhook/hr-assistant/team-handoff` |

Tools concedidas no provisionamento: `application.register`, `faq.answer`, `interview.find_slots`, `interview.schedule`, `team.handoff`.

## Contrato n8n

Pedido: `POST {N8N_BASE_URL}/webhook/<pack>/<tool>` com corpo `{identity:{tenantId,deploymentId,runId},tool,input,timestamp}`, cabeçalhos `Idempotency-Key: <runId>:<tool>` e `X-Atlas-Signature` (HMAC-SHA256 do corpo com `N8N_SIGNING_SECRET`). Só HTTPS, timeout `N8N_TIMEOUT_MS` (5 s), sem redirects. Resposta: objeto JSON. O workflow tem de verificar a assinatura, rejeitar timestamps com mais de 5 minutos e tratar a chave de idempotência.
