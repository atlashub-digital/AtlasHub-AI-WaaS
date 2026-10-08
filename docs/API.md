# API de staging

OpenAPI 3.1 em packages/contracts/openapi.json; api-types.ts gerado por openapi-typescript. JWT verifica assinatura, algoritmo permitido, issuer, audience e expiração. Membership ativa server-side define tenant e role; claim do token não concede permissões por si só. Leitura: tenant_user/admin; mutações: tenant_admin ou operador; provisionamento/reprocessamento: operador; criação de tenant: atlas_owner. Operadores também precisam de membership no tenant; não existe bypass global.

POST /v1/inbound/sandbox usa X-Atlas-Signature, HMAC SHA-256 hex do body exato. Exemplo de payload sintético:

```json
{"event_id":"synthetic-unique-001","channel_binding_id":"channel-A","timestamp":"substituir por ISO atual","payload":{"conversation_ref":"synthetic-A-1","intent_text":"Confirmo"}}
```

O timestamp tem janela de 5 minutos. tenant/deployment resolvidos pelo binding; tenant_id extra rejeitado por schema. event_id é chave de idempotência durável, mesmo em retries/concurrency. HMAC é um segredo local gerado; não colocar assinaturas/chaves em documentação. tests/e2e.mjs mostra como construir um pedido sem revelar chave.

GET roles é público; POST assessments exige business, need, consent=true. Máximo 120 POSTs/min por peer direto (proxy reverso exige desenho de rate limit específico). Lista runs/approvals/usage usa ?tenant=tenant-A, reconciliado com membership. Identificador de run fora do tenant devolve 404. Deployment cria config clinic_name/handoff_queue e limits dailyRuns/alertAt; assignee deve ter membership autorizada. Nesta versão dailyRuns limita ações de calendário registadas em UsageRecord, não todas as mensagens recebidas; orçamento de canal/LLM permanece pendente.

Approvals decide recebe {tenant,decision:approved|rejected}. Uma remarcação aprovada revalida consentimento, grant, disponibilidade e pausa na execução. Aprovar handoff clínico apenas encerra a tarefa humana; não provoca aconselhamento ou atualização de agenda. Timeout de aprovação: 1 hora, decisão expirada rejeitada. Limpeza automática/escala de expiradas ainda pendente.

Outbox de runs queued é reconciliado pelo worker a cada 5s. Falhas de execução fazem até 3 tentativas com backoff, depois dead_letter e incidente. POST /v1/ops/runs/:id/retry exige operador, tenant, run dead_letter e budget <9 tentativas; reusa identidade de execução e efeito idempotente. Histórico seguro omite input bruto; eventos guardam somente IDs administrativos, estados, motivos e horários sintéticos.

Health é liveness; ready verifica DB e Redis. Não se expõem interfaces administrativas de n8n. Connector n8n assina identidade derivada, fixed paths e Idempotency-Key, valida input/output, impõe TLS e timeout e rejeita redirects. Ainda não ligado ao fluxo de staging: integração remota depende de workflow homologado e acesso ao ecossistema existente.
