# Round 2 — estado

**Responsável técnico:** Claude Code, por decisão do Founder (2026-10-08). Mantém-se o mandato, os gates e a política de autonomia de [ROUND-2-MAX-HERMES-CODEX.md](ROUND-2-MAX-HERMES-CODEX.md).

A auditoria detalhada das VPS fica no repositório privado `atlas-ops`, porque este repositório é público.

## Checkpoint 1 — 2026-10-08

1. **Verificado:** G0 só de leitura nas duas VPS. Decisão: staging no host onde já correm o n8n e o Chatwoot, isolado (projeto Compose próprio, Postgres e Redis próprios em rede interna sem saída, API só em loopback, sem alterações ao edge/Caddy partilhado).
2. **Alterado:** `infra/compose.staging-remote.yml` e `scripts/deploy-staging-remote.sh`. Nenhum serviço existente alterado.
3. **Testes:** deploy remoto ainda não executado.
4. **Riscos:** o host é partilhado com produção. Mitigação: limites de memória e CPU (~1,3 GiB no máximo), sem redes/portas/volumes partilhados, e o script aborta com menos de 2 GiB de memória disponível.
5. **Bloqueios:** acesso administrativo ao projeto Supabase do AI-WaaS (conector ligado a outra organização).
6. **Próxima ação:** executar o deploy, verificar `/health` e `/ready` e a saúde dos serviços vizinhos; depois limpar o Supabase, ativar o Auth real e uma role de runtime mínima com RLS por tenant, e repetir os testes A/B.

## Checkpoint 2 — 2026-10-08

1. **Verificado:** staging remoto `ai-waas-staging` a correr na VPS: API, worker, Postgres e Redis healthy, 0 reinícios. `/health` 200, `/ready` 200. Consumo ≈115 MiB no total. Serviços vizinhos (n8n, LeveLab/LIA, Atendimento.Center, Chatwoot, Evolution) inalterados e saudáveis.
2. **Alterado:** só o novo projeto Compose isolado; migrations `202610080001_initial` e `202610080002_integrity` e fixtures sintéticas A/B aplicadas à base dedicada. Nenhuma alteração a Caddy/edge ou a outros projetos.
3. **Testes em remoto** (container efémero na rede da API, `tests/` só leitura):
   - `tests/e2e.mjs`: **14/14 PASS** — T04 (×2), T05, T06, T07, T08/E10, T09/T10/E08, T14, E01/E07, E02, E03, E04/E05, E06, E09.
   - `tests/database-security.mjs`: **2/2 PASS** quando corrido depois dos E2E (ordem documentada). O teste de FK cross-tenant é frágil: se não existir nenhum `TaskRun` do tenant A, o `INSERT … SELECT` insere zero linhas e falha sem haver defeito. Corrigir no teste (garantir pré-condição).
   - Não executados ainda em remoto: readiness/outage, backup-restore, browser.
4. **Riscos:** autenticação ainda em `AUTH_MODE=staging` (JWT partilhado); a ligação DB do backend continua proprietária (RLS por tenant não aplicada no caminho real — ADR-001).
5. **Bloqueios:** ferramentas Supabase indisponíveis nesta sessão; o primeiro run do script de deploy parou depois das migrations (seed e arranque concluídos à mão, sem erro reproduzível).
6. **Próxima ação:** auditar e limpar o projeto Supabase; `AUTH_MODE=supabase` (JWKS ES256) com utilizadores de teste; role de runtime mínima e RLS por tenant; repetir A/B.

## Checkpoint 3 — 2026-10-08

1. **Verificado:** acesso administrativo ao projeto Supabase do AI-WaaS. Antes da limpeza o projeto continha apenas dados de teste de outro produto (sem transações), sem dependências em execução.
2. **Alterado:** projeto Supabase limpo por autorização explícita do Founder (sem backup, a pedido): schema `public` vazio e sem grants por defeito para `anon`/`authenticated`; Auth, Vault e histórico de migrations vazios. Advisor de segurança: sem avisos.
3. **Testes:** n/a.
4. **Riscos:** nenhum serviço dependia do projeto (verificado nos containers em execução).
5. **Bloqueios:** nenhum para o G1.
6. **Próxima ação:** G1 — `AUTH_MODE=supabase` (JWKS ES256) com utilizadores e memberships de teste; role de runtime mínima e RLS por tenant no caminho real do backend; repetir A/B.

## Checkpoint 4 — 2026-10-08

1. **Verificado:** alinhamento com o pedido e modelo de dados v2 publicados ([ROUND-2-ALIGNMENT](ROUND-2-ALIGNMENT.md), [DATA-MODEL-v2](DATA-MODEL-v2.md)).
2. **Alterado:**
   - Migration `202610080003_runtime_rls`: role `waas_runtime` sem `BYPASSRLS` nem DDL; políticas `tenant_isolation` e `platform_operator` em todas as tabelas de tenant; scopes estreitos só de leitura para pesquisas antes do tenant (memberships próprias, inbound, resolve, worker); catálogo só leitura; histórico de migrations privado.
   - API e worker executam cada query numa transação ligada ao tenant (`set_config`), e recusam arrancar com uma role privilegiada.
   - `scripts/runtime-role.mjs`, Compose e CI passam a correr a app como `waas_runtime`.
   - Staging VPS atualizado; merge em main após CI verde.
   - Supabase: só a migration 001 (tabelas) aplicada.
3. **Testes:**
   - Staging remoto com a app em `waas_runtime`: E2E **14/14**, segurança DB **2/2**, novo `tests/runtime-rls.mjs` **6/6**.
   - GitHub Actions: **PASS** ([run 37744163510](https://github.com/atlashub-digital/AtlasHub-AI-WaaS/actions/runs/37744163510)).
   - Nota: entre corridas de E2E é preciso o reset dos fixtures (o E10 deixa o deployment A em pausa).
4. **Riscos:** o Supabase tem a 001 sem a 002/003; verificado que `anon`, `authenticated` e `service_role` não têm nenhum grant nas tabelas, e as tabelas estão vazias.
5. **Bloqueios:** a aplicação das migrations 002/003 no Supabase foi recusada pela política de permissões da sessão.
6. **Próxima ação:** aplicar 002/003 no Supabase; criar o login de `waas_runtime` por verificador SCRAM (a password fica só na VPS); ligar o staging ao Supabase pelo pooler; Auth Supabase real com utilizadores de teste; repetir A/B.

## Checkpoint 5 — 2026-10-08

1. **Verificado:** os 8 colaboradores digitais funcionam ponta a ponta em staging remoto, contra sistemas sandbox stateful (CRM, caixa de correio, imóveis, encomendas, conteúdos, faturas/extratos, candidaturas). Registo técnico em [ROLES.md](ROLES.md).
2. **Alterado:**
   - Motor genérico de roles (`packages/roles`, `services/worker/src/engine.ts`) para ROLE-002..008. A ROLE-001 mantém o executor do Round 1.
   - Gateway de tools com grant, schema e política por tool (automática, aprovação humana ou proibida); aprovações ligadas a um hash do input; efeitos idempotentes por run; rascunhos congelados por run; remoção de atributos sensíveis (RH).
   - Camada de IA opcional (Claude, desligada por defeito, `LLM_ENABLED=1`): só classifica mensagens não reconhecidas e escreve rascunhos que exigem aprovação.
   - Migration 005 (`SandboxRecord` com RLS), aplicada no staging da VPS e no Supabase.
   - Seed `seed-roles.mjs`, adaptador n8n por tool e contratos de inbound e provisionamento alargados aos 8 roles.
3. **Testes:**
   - Staging remoto: ROLE-001 E2E **14/14**, segurança DB **2/2**, RLS **6/6**, `tests/roles.e2e.mjs` **10/10**, repetível sem reset.
   - Supabase: RLS **6/6** pelo pooler (TLS) com `waas_runtime`.
   - GitHub Actions: **PASS** ([run 37750160306](https://github.com/atlashub-digital/AtlasHub-AI-WaaS/actions/runs/37750160306)).
4. **Riscos:** as integrações reais (CRM, email, ERP, loja, ATS, redes sociais) ainda são sandboxes; o n8n existe mas os workflows por tool não estão ativos; a IA não foi exercitada com chave real (falta `ANTHROPIC_API_KEY` no staging).
5. **Bloqueios:** ativação de workflows n8n (precisa de acesso de owner ao n8n ou de autorização para reiniciar o serviço); Auth Supabase real (utilizadores de teste); chave da API Anthropic para testar a IA.
6. **Próxima ação:** packs 004–008 no `atlas-agent-packs`; catálogo da App com os 8 roles em demo funcional; workflows n8n; Auth Supabase; Fase B (CRM/catálogo comercial).

## Checkpoint 6 — 2026-10-08

1. **Verificado:**
   - Staging em Supabase (`ai-waas-supabase`): API e worker no Supabase pelo pooler como `waas_runtime`, Auth real por JWKS ES256.
   - IA via OpenRouter (modelo gratuito) em staging, com dados sintéticos.
2. **Alterado:**
   - `infra/compose.supabase-staging.yml` e `scripts/supabase-staging-setup.sh`: configuração a partir de ficheiros de chaves `0600` e 4 utilizadores de teste no Supabase Auth.
   - Memberships desses utilizadores nos tenants A/B.
   - Provider `openrouter` em `llm.ts`.
   - Primeiro workflow n8n versionado (`infra/n8n/`) e `scripts/n8n-staging-setup.sh` (importa e ativa pela API do n8n, sem reinício).
3. **Testes:**
   - `tests/supabase-auth.mjs` **4/4**: isolamento A/B com sessões reais; membro só de leitura sem escrita; tokens forjados ou alterados e ausência de token → 401; refresh e logout (o refresh deixa de funcionar depois do logout); ROLE-001 ponta a ponta sobre o Supabase com RLS.
   - IA: mensagem em inglês fora das regras → `meeting` (0,95); injection → `unknown`; rascunho gerado (sujeito a aprovação).
   - GitHub Actions: **PASS** ([run 37755632476](https://github.com/atlashub-digital/AtlasHub-AI-WaaS/actions/runs/37755632476)).
4. **Riscos:**
   - Os tokens de acesso continuam válidos até expirarem depois do logout (JWT sem estado); a revogação de membership é imediata no servidor.
   - Modelos gratuitos do OpenRouter podem registar pedidos: só dados sintéticos.
5. **Bloqueios:** a importação e ativação do workflow n8n foram recusadas pela política de permissões da sessão (serviço partilhado); o script fica pronto para execução manual.
6. **Próxima ação:** correr `scripts/n8n-staging-setup.sh`; provisionar a ROLE-006 no Supabase com `n8n_tools: ["research.collect"]` e testar o caminho worker → n8n → feeds; Fase B (CRM/catálogo comercial).

## Checkpoint 7 — 2026-10-08

1. **Verificado:** primeira integração real de ponta a ponta. Inbound assinado → API/worker no Supabase (RLS, `waas_runtime`) → n8n por HTTPS (Header Auth + HMAC) → feeds RSS públicos reais → resultado auditado. Rascunho de post escrito pela IA (OpenRouter, modelo gratuito) e guardado como `draft`.
2. **Alterado:**
   - Workflow `waas-staging · marketing-assistant · research.collect` importado e ativo (pelo Founder com `scripts/n8n-staging-setup.sh`).
   - Catálogo dos 8 roles e pack releases no Supabase.
   - ROLE-006 provisionada no tenant A **pela API** com sessão real do owner (`n8n_tools: ["research.collect"]`).
   - Canal de teste `channel-A-006`.
3. **Testes:**
   - Webhook n8n: sem token 403; com token 200 em 0,6 s.
   - Pesquisa: concluída em 5,9 s com 5 artigos reais.
   - Post: concluído em 12 s; rascunho da IA; 0 fontes licenciadas (feeds sem licença, corretamente excluídos).
   - Tools concedidas: `post.publish` nunca concedida; `post.schedule` com aprovação.
4. **Riscos:** os conteúdos dos feeds não são licenciados para republicação; a IA gratuita só com dados sintéticos.
5. **Bloqueios:** nenhum para continuar.
6. **Próxima ação:** workflows n8n das restantes tools com sistemas de teste; endpoint de API para ligar canais (hoje feito em SQL); inbox de teste no Chatwoot; Fase B (CRM/catálogo comercial); OpenAPI dos 8 roles.

## Checkpoint 8 — 2026-10-09 (Fase B)

1. **Verificado:** plataforma comercial ponta a ponta em staging. Catálogo em 5 línguas; simulação; lead com prova de consentimento; teste gratuito de 3 ou 7 dias com aprovação humana e expiração automática; proposta, aceitação, fatura, pagamento (webhook verificado e confirmado no provider), acessos e missão; importação de leads com base legal; supressões.
2. **Alterado:**
   - Migration 006 (29 tabelas com RLS), aplicada no staging e no Supabase.
   - API pública do funil, API de operação e API de faturação do cliente.
   - Adaptadores de pagamento Mercado Pago (PIX), Stripe e sandbox; worker de faturação.
   - Seed comercial: tenant interno, emissores UK/BR, 8 missões × 5 línguas, preços em `draft`.
   - Catálogo carregado no Supabase.
   - Pacote da Clara para o Hermes (`docs/clara/`).
3. **Testes:**
   - Staging: unitários **13/13**; ROLE-001 E2E **14/14**; segurança e RLS **8/8**; roles **10/10**; `tests/commerce.e2e.mjs` **7/7**.
   - Uma segunda corrida seguida bate no limite de 120 POST/min por IP (429): o limite funciona como previsto.
   - GitHub Actions: **PASS** ([run 37759899046](https://github.com/atlashub-digital/AtlasHub-AI-WaaS/actions/runs/37759899046)).
   - Supabase: catálogo em francês servido pela API; lead registado com consentimento em pt-BR.
4. **Riscos:**
   - Os preços estão todos em `draft` (nada é mostrado nem cobrado até aprovação).
   - Os emissores têm dados legais por confirmar.
   - A fatura é um documento comercial de teste, não fiscal.
   - Transferência internacional LGPD por formalizar.
   - Advisor Supabase: "Leaked Password Protection" desligada no Auth.
5. **Bloqueios:**
   - Credenciais Mercado Pago e Stripe (em modo teste) para exercitar os providers reais.
   - Fornecedor de email para a entrega de faturas.
   - Aprovação dos preços.
6. **Próxima ação:** página de vendas em funil (simuladores, teste gratuito, proposta) no App.AtlasHub.Si sobre esta API; francês e pt-BR por defeito no motor de roles; endpoint de canais; email transacional.
