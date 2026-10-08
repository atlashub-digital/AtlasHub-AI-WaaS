# Runbook de staging e incidente

1. Carregar `.env.staging` sem tracing. Consultar health/ready e metrics/incidents com JWT autorizado no tenant. Não imprimir ambiente, tokens, connection strings ou logs SQL completos.
2. Incidente de integração: operador pausa deployment na API; confirmar novas mensagens em estado suspended; consultar runs dead_letter e incidentes. O backend não envia mensagens reais nesta versão.
3. Restaurar dependência; reprocessar run por POST ops/runs/:id/retry, mantendo run e idempotência. Máximo nove tentativas acumuladas; não criar novo event_id para contornar quota/idempotência.
4. Aprovação clínica significa atendimento humano; não dar orientação clínica nem executar ferramentas administrativas a partir desse texto. Reschedule exige nova validação de slot, consentimento e pausa. Aprovações expiram após uma hora; a decisão é rejeitada, mas escalada/limpeza automática ainda pendente.
5. Backup: `scripts/backup-restore.sh` cria dump local e restaura em `waas_restore` apenas se esse destino estiver ausente. Validação observada: 17 runs recuperados. Snapshot não é backup externo nem cifrado; dados sintéticos somente. Guardar exportações de produção cifradas no secret/backup store definido depois da auditoria.
6. Rollback de código: pausar, parar apenas processos deste serviço, voltar à imagem/commit anterior compatível, verificar ready e um pedido sintético antes de retomar. Não executar compose down -v nem down destrutivo em dados reais.
7. Restore de produção: restaurar num destino novo, verificar contagens/constraints e isolamento, depois promover ligação aprovada. Nunca substituir diretamente o projeto Supabase só com base no URL. A autorização de reconstrução existe; execução depende de acesso, inventário e backup recuperável.

## Inventário remoto pendente

A ligação SSH fornecida recusou conexão; o primeiro erro de configuração SSH local foi isolado usando -F /dev/null. Não foram alterados firewall, serviços, volumes ou agentes Hermes. Quando acesso funcionar, recolher apenas hostname/resources, container names/images/status/ports, networks/volumes, compose projects e unidades falhadas, sem docker inspect/env dumps. Identificar projetos e portas existentes antes de instalar; reutilizar n8n/Hermes aprovados, sem duplicação automática.

Supabase: adicionar/autenticar MCP ao ambiente por mecanismo suportado. CLI local não conseguiu escrever configuração num filesystem só de leitura. Auditar schemas, extensões, auth/users, storage, policies, functions e dependências; obter dump/backup verificável. A limpeza autorizada limita-se ao projeto indicado, não a outras bases/vinculações. Nunca publicar credenciais administrativas no frontend.
