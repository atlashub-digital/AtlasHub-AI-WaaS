# Baseline verificada — Round 1

Ambiente cloud isolado, 07/10/2026 (America/Sao_Paulo). Nenhuma produção alterada. README e docs 00–05 lidos integralmente na ordem definida, seguidos de catálogo, playbook VPS e auditoria existente.

| Repositório | HEAD inicial | Resultado observado |
|---|---|---|
| AtlasHub-AI-WaaS | 2cbc02e214f8f1d92265ca64add9c6220cbddcc9 | Apenas documentação; sem backend existente |
| App.AtlasHub.Si | 4a2052924c220f126a907faff1bea5a06df7e456 | npm ci; 10 testes; lint, typecheck, build passaram |
| atlas-agent-packs | bdce89cf294dec8287515bcfb3234b5f5c031871 | 1 pack válido + template; 3 testes; catálogo gerado |

Checkouts inicialmente limpos; não foram criados worktrees. Node 24.19.0/npm 11.9.0 disponíveis; Docker 28.4.0; recursos suficientes para dois workers e os serviços locais. Node 22.20.0 selecionado para container/CI. Git HTTPS ls-remote origin HEAD funcionou para os três repos através da autenticação existente.

Acesso remoto: CLI GitHub informou credencial inválida; chamada REST foi proibida. Push dry-run devolveu HTTP 403, identidade nexflowx-hub sem permissão no repositório principal. SSH inicial falhou por permissões de configuração do sistema; com configuração vazia, ligação à porta indicada foi recusada. Supabase HTTPS bloqueado pela política de egress; nenhum binding Supabase/DB/SSH disponível na máquina. Nenhum inventário da VPS foi obtido e não se presume o estado do Hermes, n8n ou das bases remotas.
