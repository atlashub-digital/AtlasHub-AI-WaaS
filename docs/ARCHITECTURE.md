# Arquitetura de referência — AI-WaaS

## Fronteiras de responsabilidade
| Sistema | Responsabilidade | Não deve fazer |
|---|---|---|
| `atlas-agent-packs` | Fonte versionada dos packs, ferramentas e cenários | Guardar clientes, contratos, segredos |
| `App.AtlasHub.Si` | Catálogo, simulação da Clara, aquisição e portal cliente | Conter credenciais ou lógica privilegiada no browser |
| `AtlasHub-AI-WaaS` | Control plane de serviços: catálogo comercial, tenancy, assinaturas, provisioning, operações e billing | Duplicar o motor de packs ou a UI atual |
| Hermes Agent | Interpretação e execução confinada por ferramentas | Acesso direto irrestrito a sistemas ou chaves |
| n8n | Orquestração determinística e adaptadores de integração | Misturar credenciais entre clientes |
| Atendimento.Center | WhatsApp, webchat, filas e handoff | Decidir autonomamente processos regulados |
| Atlas.SI OS / PaperClip | Coordenação interna, tarefas, supervisão e runbooks | Ser o único mecanismo de controlo de produção |

## Fluxo de produção
Canal → entrada autenticada e roteamento de tenant → política/limites → sessão de agente → tool gateway com autorização por tenant → workflow n8n específico → sistema autorizado → evento de execução → auditoria, métricas e eventual handoff.

Eventos de execução devem ter: tenant_id, deployment_id, pack_id, pack_version, run_id, correlation_id, tool_id, status, timestamps, custo estimado e classificação de dados; nunca tokens e chaves em logs.

## Entidades propostas
Tenant, CustomerContact, CommercialRole, AgentPackRef, ServicePlan, Offer, Subscription, EmployeeDeployment, IntegrationConnection, ToolGrant, TaskRun, TaskEvent, HumanApproval, Handoff, SLA, Incident, UsageRecord, InvoiceReference, AuditEvent.

## Ciclo de vida de deployment
`requested → assessment → approved → provisioning → sandbox → acceptance → active → paused → suspended → terminated`.
Cada transição com responsável, auditoria e rollback. Não ativar automaticamente após pagamento; exigir autorização e testes de aceitação.

## Segurança mínima
- RLS e validação server-side por tenant, com testes negativos cross-tenant.
- Separação de segredos em vault/secret store; OAuth e tokens de menor privilégio.
- Autorização no tool gateway independente do texto produzido pelo modelo.
- Human-in-the-loop para compromissos, mensagens de maior impacto, exclusões, pagamentos e decisões regulamentadas.
- Limites de custo e volume; timeouts, retries idempotentes, circuit breakers, rate limiting e kill switch por cliente.
- Isolamento de ferramentas, proibição de execução arbitrária, prevenção de prompt injection e sandbox para código.
- Política de privacidade, base legal, retenção, eliminação e gestão de incidentes em conformidade com LGPD.
- Observabilidade e alertas mantidos pela AtlasHub, não dependentes de disponibilidade do LLM.

## API inicial proposta (não implementada)
`GET /roles`; `POST /assessments`; `POST /offers`; `POST /subscriptions`; `GET /deployments/:id`; `POST /deployments/:id/pause`; `GET /deployments/:id/runs`; `GET /usage`; `POST /approvals/:id/decision`; `GET /sla/reports`.
Todas as rotas privadas exigem autenticação, autorização, tenancy e trilha de auditoria.

## Design operacional
1. Pack = versão imutável; deployment fixa versão e recebe atualizações após canary e homologação.
2. Serviço = combinação de pack + perfil comercial + configurações + tool grants + SLA.
3. Execuções não podem atravessar tenants, mesmo com instâncias compartilhadas de runtime.
4. Medidas de custo e qualidade são coletadas por tarefa e cliente.
5. Runbooks de falha devem operar sem depender de uma única instância Hermes/PaperClip.
6. Plano de disaster recovery: backup, restauração testada, rotação de credenciais e exportação de dados na rescisão.

## Estratégia de infraestrutura
MVP: usar infraestrutura já disponível, após auditoria de segurança e capacidade, sem novos frameworks por padrão. Avaliar Postgres/Supabase como dados de controlo, n8n e Hermes geridos, Atendimento.Center para canais; Vercel para o frontend. Não confundir instâncias de demonstração com produção.
