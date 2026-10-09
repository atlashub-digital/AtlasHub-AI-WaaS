# 06 — Riscos e decisões pedidas

| # | Risco | Severidade | Evidência | Mitigação proposta | Dono |
|---|---|---|---|---|---|
| R1 | **Entitlements não são aplicados**: um tenant sem compra ou com trial expirado continua a poder ter deployments e runs | Alta | Nenhuma leitura de `commerce_entitlement` em `services/` ([03 §4](03-AUTH-ENTITLEMENTS.md)) | PR-E (leitura) → PR-F (aplicação com flag e testes A/B) | Claude |
| R2 | **Desvio do contrato:** 20/39 rotas fora do `openapi.json` e 0 schemas de resposta. O FE geraria tipos errados | Alta | [01 §4](01-AUDITORIA.md) | PR-C: documentar a Fase B e as respostas; teste de CI que falha se uma rota não estiver no contrato | Claude · revisão Codex |
| R3 | **Repositórios públicos** (AI-WaaS e Workspaces; F23): contratos, nomes de tabelas e regras de autorização visíveis | Média | Auditoria de Governação V1 | Decisão do Founder sobre a visibilidade antes do G2. Estes documentos não têm segredos nem detalhes de infraestrutura | Founder |
| R4 | **Sem ingress HTTPS do Core**: o Workspaces (Vercel) não chega à API | Alta para o G2 com dados | Staging só em loopback (ver `atlas-ops`) | Hostname dedicado com TLS e allowlist de caminhos, ou túnel; exige G0 e autorização do owner da VPS | Founder · infra |
| R5 | **Rate limit por IP direto** (120 POST/min): atrás de BFF/proxy, todos os clientes partilham o limite | Média | `services/api/src/main.ts` | Proxy de confiança (`X-Forwarded-For` só do edge conhecido) e limite por `sub` nas rotas autenticadas | Claude |
| R6 | **Auth staging HS256** em ambientes de teste partilhados | Média | `auth.ts` | Já bloqueado em `NODE_ENV=production`. Usar `AUTH_MODE=supabase` em qualquer ambiente acessível ao FE | Claude |
| R7 | **Clientes sem utilizadores**: tenant criado em trial ou quote sem membership | Média | `commerce.ts` (`approveTrial`, `quotes/accept`) | Convites (03 §5), depois do G2 | Claude |
| R8 | **Aprovações expiradas ficam `pending`** (não há limpeza) | Baixa | `API.md` + código | FE marca expirada por `expiresAt`; job de limpeza depois | Claude |
| R9 | **Dois catálogos de pacotes desalinhados**: o App usa packs 0.3.0, a branch tem 0.3.1 e o Core tem `PackRelease` próprio | Média | PR #2 packs; `catalog.json` do App | O Workspaces lê só o Core; sincronizar o App depois do merge do PR #2 | MGJ · Claude |
| R10 | **Verificação local em Postgres 16** (CI em 17.6); readiness/backup não corridos aqui | Baixa | 01 §1–2 | A CI dos PRs #7 e deste PR corre tudo em 17.6 | Codex (QA) |
| R11 | **Repositório Workspaces vazio**: risco de o FE avançar sem contrato | Média | `main` = só README | Este contrato é a entrada; o FE gera tipos do rascunho | MGJ |
| R12 | **CI intermitente**: o mesmo commit (`6f19fb9`) falhou no run de `push` e passou no de `pull_request`; o *re-run* passou (attempt 2) | Média | Run 37968811186 (attempt 1 ✗, attempt 2 ✓) e run 37968860376 ✓. Os logs não são acessíveis desta sessão | O revisor confirma pelo log da tentativa 1. Candidato conhecido: o teste de FK cross-tenant depende da ordem (`ROUND-2-STATUS` checkpoint 2). Corrigir a pré-condição num PR de testes | Codex (QA) · Claude |

## Decisões pedidas ao Founder

1. **Ratificar G0**: fronteiras, owners e visibilidade (F23). Sem isso, os PRs ficam em draft e nada é integrado.
2. **Ingress do Core** para o ambiente que o Workspaces vai usar (R4).
3. **Aprovar a convenção `module.<nome>`** para entitlements e a concessão manual por operador (`grant`).
4. **AMI como Role/Pack no catálogo único** (05 §2), em vez de um serviço próprio.
