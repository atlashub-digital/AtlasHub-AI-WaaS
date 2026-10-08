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
