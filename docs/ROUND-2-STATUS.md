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
