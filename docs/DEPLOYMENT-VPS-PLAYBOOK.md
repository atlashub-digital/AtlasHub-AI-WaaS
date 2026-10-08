# Playbook de infraestrutura e subida à VPS — AI-WaaS
**Estado:** plano de implantação; NÃO EXECUTADO nas VPS. Não presumir endpoints, credenciais ou recursos existentes.

## 0. Inventário obrigatório (leitura apenas)
Levantar em cada VPS: `hostnamectl`, `uname -a`, `free -h`, `df -h`, `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'`, `docker network ls`, `docker volume ls`, `ss -tulpen`, `systemctl --failed`, `docker compose ls`. Nunca recolher variáveis com senhas nos relatórios. Identificar backups, domínio, DNS, Caddy, Redis, Postgres/Supabase, n8n, Chatwoot, Evolution e Hermes. Não executar comandos disruptivos na auditoria.
Confirmar CI e dependências do frontend (Next) e de `atlas-agent-packs`. Capturar disponibilidade operacional de cada ferramenta com endpoints autenticados e testes não destrutivos.

## 1. Topologia mínima proposta
- Vercel: `app.atlashub.si` (catálogo, simulador e, após autenticação, portal).
- VPS: serviço privado `ai-waas-api` (NestJS; control plane e tool gateway) e `ai-waas-worker` (BullMQ).
- PostgreSQL/Supabase: tenants, roles, subscriptions, deployments, runs, approvals, usage, audit. RLS e RBAC.
- Redis: filas, rate limit e jobs; não guardar dados sensíveis permanentemente.
- n8n já instalado: integrações determinísticas com credenciais seguras e isolamento por tenant.
- Hermes já existente: execução agentic quando necessária, configuração e contexto por tenant, sem acesso privilegiado direto.
- Atendimento.Center: interface WhatsApp/webchat e handoff; roteamento para API autenticada.
- Caddy: TLS, proteção de origem e roteamento para `api-waas.atlashub.si` se aprovado por DNS.
- Observabilidade: métricas, logs estruturados por execução, alertas e backup.

## 2. Não instalar por padrão
Nem PaperClip, nem OpenClaw, nem segunda instalação n8n, nem DB duplicada antes de confirmar capacidade e segurança. Não acoplar o serviço a um único agente ou bot pessoal.

## 3. Sequência de implantação
**G0 Auditoria:** documentação dos serviços e risco; snapshots/backup verificados; capacidade para processos adicionais; escolha de VPS e DNS.
**G1 Infra:** ambiente `staging`, variáveis por secret store, health endpoints, serviço Docker com restrição de redes, proxy HTTPS e deploy automatizado reversível.
**G2 Control plane:** migrations revisadas, RLS/RBAC, auth, quotas e audit; testes cross-tenant.
**G3 Orquestração:** fila e worker idempotente; tool gateway autoriza tenant+deployment+tool; n8n invocado com autenticação interna; timeout, retry, dead-letter queue e circuit breaker.
**G4 Canais:** mensagens entram por webhooks assinados/verificados, eventos com idempotency key e handoff humano.
**G5 Piloto:** ROLE-001 testada end-to-end em sandbox; lançamento assistido após aprovação formal.

## 4. Segurança essencial
Isolamento forte de credenciais e mensagens por cliente; impedir acesso cruzado em DB e ferramentas; logs mínimos e retenção explícita. Nunca montar Docker socket nem permitir shell arbitrário ao runtime do agente. Separar operadora AtlasHub de cliente final. Segurança de APIs, assinatura de webhooks, autenticação serviço-a-serviço, quotas e kill switch. Transações de alto impacto precisam de aprovação humana. TLS e backups testados.

## 5. Critérios de go/no-go
Não ir ao ar se: faltam testes de isolamento, inexistem responsáveis por incidentes, não há rollback, segredos estão expostos, consentimentos não estão cobertos, faltam alertas ou o custo do canal/LLM está sem limite.

## 6. Licenças n8n
Verificar enquadramento da Sustainable Use License antes de SaaS/white label. Serviço de workflows operados internamente pode ter tratamento distinto de dar aos clientes capacidade de desenhar/configurar workflows. Confirmar com o fornecedor no âmbito exato do modelo AI-WaaS antes da comercialização. Fonte: https://support.n8n.io/article/can-i-use-your-license-for-my-use-case

## 7. Relatório da auditoria
`docs/VPS-AUDIT-RESULT.md` deve listar máquina (apelido não sensível), recursos, serviços/versões, dependências, topologia, backups verificados, portas internas necessárias, riscos, decisão de staging/prod e sequência de comandos específica para esse ambiente. Não colocar ips privados/senhas nem tokens em Git.
