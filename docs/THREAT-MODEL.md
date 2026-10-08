# Threat model e decisão de segurança

Escopo verificado: staging local com dados sintéticos. Não certifica produção nem o ecossistema remoto.

| Fronteira/ameaça | Controlo implementado | Evidência/limite |
|---|---|---|
| JWT falsificado/expirado | jose, algoritmos allowlist, issuer/audience/expiração, membership server-side | Testes de 401/403; login/JWKS Supabase remoto não exercitado |
| Tenant informado pelo utilizador | Identidade por canal assinado/membership; scope explícito; FKs compostas | E09 e teste DB negativo passaram |
| Acesso direto PostgREST | RLS default deny; revoke para public/anon/authenticated | Role SQL sem privilégios não lê agenda; backend proprietário contorna RLS, precisa de role mínima/contexto antes de produção |
| Replay/duplicação | HMAC raw body, janela temporal, unique deployment/event, efeito idempotente em transação | E01/E07 concorrentes passaram; duplicate legítimo dentro da janela recupera run existente |
| Prompt injection/PII | Classificador determinístico, sem LLM/shell, ferramentas allowlist, input strict, eventos minimizados | T09/T10; texto bruto persiste em runs pendentes para retoma, sem ser exposto no portal; limpeza/retention automáticas pendentes |
| Confirmação indevida | Consentimento persistido e ownership administrativo | E05; não há canal outbound real |
| Dupla reserva | Claim de slot, optimistic version, transação e locks | E06; integridade não cobre ainda calendário externo |
| Pausa concorrente | Lock do deployment precede política e mutação; transição update toma lock DB | E10; worker revalida antes de ação |
| Tool inesperada | Schema/grant por tenant+deployment, paths fixos n8n, resposta tipada, TLS e timeout | Unit/integration; nenhum workflow n8n real chamado |
| Sobrecarga/custos | Limite POST/peer, quota de ações, incidente threshold, retries limitados | T14; apenas custos externos sintéticos zero, infraestrutura/canal/LLM sem benchmark |
| Falhas operacionais | Outbox, retries/DLQ, incidentes, readiness, backup restore separado | Testes locais passaram; sem notificações externas de incidentes |
| Escalada cliente | Sem editor n8n, tool arbitrary ou shell; aprovação protegida, CSRF same-origin/Server Actions, cookie HttpOnly | Browser cross-tenant e redirects; revisão de sessão/refresh real Supabase pendente |

Não usar AUTH_MODE=staging em NODE_ENV=production. Não expor Postgres/Redis/API sem proxy privado/TLS. Nenhum segredo em manifestos ou PRs; .env.staging modo 0600, ignorado. Valores gerados são exclusivos da máquina. Falhas API devolvem mensagens genéricas sem stack SQL; worker regista motivos técnicos genéricos.

Antes de homologação: auditoria independente da autorização, runtime DB least privilege com RLS por tenant, limites de custos reais, consentimento/canais oficiais, retenção e expiração automática com owner humano, backup externo cifrado, rotação de chaves e sessão Supabase real. Não há declaração de ausência de vulnerabilidades críticas em produção: ambiente remoto não auditado.
