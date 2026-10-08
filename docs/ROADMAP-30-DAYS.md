# Plano operacional — primeiros 30 dias
Marco zero: 2026-10-07. Durações são metas de planeamento, não compromissos de deploy.

## Semana 1 — produto e primeira operação
- Congelar baseline dos repositórios existentes, CI, testes e estado real do deploy.
- Rever o PACK-001; definir papel comercial «Rececionista Digital».
- Inventariar integrações de agenda e WhatsApp necessárias; validar licenças de n8n/templates.
- Criar ficha de serviço e matriz de funções vs ações que exigem aprovação.
- Construir um workflow n8n real com entradas/saídas tipadas e autenticação.
- Criar sandbox isolada com dados sintéticos; executar testes A01–A08.
**Gate:** sem demonstração «real» antes dos testes.

## Semana 2 — controlo de produção
- Modelar Tenants, Subscriptions, Deployments, TaskRuns, UsageRecords, Incidents e Approvals.
- Implementar RBAC/RLS, tool gateway, segregação de segredos, logs, kill switch e limites.
- Definir runbooks: falha do canal, falha da agenda, indisponibilidade do LLM, resposta incorreta e handoff.
- E2E em sandbox com carga básica, testes negativos cross-tenant e recuperação.
**Gate:** nenhum dado real antes da revisão de privacidade/segurança.

## Semana 3 — experiência e comercial
- Manter simulator V0 estável; acrescentar vista de funções e escolha «serviço gerido».
- Atualizar guião da Clara: diagnóstico, simulação, escopo, benefício e consulta.
- Montar portal de cliente mínimo: status, tarefas, exceções, uso, relatórios e suporte.
- Preparar contratos, onboarding, tabela preliminar de preços e medição de custos reais.
**Gate:** preços publicados só depois da aprovação.

## Semana 4 — piloto assistido
- Selecionar 1–2 clientes piloto com consentimento e escopo simples.
- Homologar integração por cliente; acompanhar diariamente falhas, custos e aprovações.
- Refinar suporte, métricas e margem; produzir estudo de caso apenas autorizado.
- Decidir GA ou extensão do piloto com base em segurança, SLA e resultado medido.

## Backlog P0
P0.1 Audit repos + baseline CI e deploy.
P0.2 Contrato do serviço gerido e escopo do MVP.
P0.3 Workflow real PACK-001 + testes de aceitação.
P0.4 Tool gateway tenant-aware + secrets.
P0.5 Modelo Subscription/Deployment/TaskRun.
P0.6 Dashboard operacional + intervenção humana.
P0.7 Clara: narrativa serviço gerido + funil.
P0.8 Segurança/LGPD + termos.
P0.9 Telemetria custos/qualidade.
P0.10 Piloto com rollback.

## Backlog P1
Assistente comercial; Secretária digital; portal avançado; automação de billing; planos por volume; catálogo por segmento; operação multi-tenant em escala.

## Definition of Done
Código versionado; PR revisto; testes/CI verdes; documentação/ADR; matriz de permissões; logs/alertas; plano de rollback; homologação assinada pelo owner; custo operacional medido; suporte com pessoa responsável.

## Coordenação
O repositório AI-WaaS é fonte de verdade comercial/operacional. Cada implementação deve gerar issue no repositório técnico apropriado; não copiar código entre repositórios. Claude Code implementa somente após auditoria inicial; não alterar diretamente produção sem aprovação explícita.
