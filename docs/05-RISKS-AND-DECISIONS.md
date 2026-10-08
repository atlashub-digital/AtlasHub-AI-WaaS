# Riscos, conformidade e decisões executivas — AI-WaaS
**Revisão 2026-10-07**

## Riscos bloqueantes para produção
| ID | Risco | Mitigação obrigatória | Verificação |
|---|---|---|---|
| R-01 | Mistura de clientes no runtime, banco e canais | Tenant derivado de identidade verificada, RLS/grants, testes cross-tenant, segredos isolados | T04, T09, T12 |
| R-02 | Automação envia respostas indevidas ou compromissos sem aprovação | Tool grants, validação de dados, HITL, kill switch, limites, filas idempotentes | T05–T10, E03–E08 |
| R-03 | Dados pessoais e administrativos de saúde | Minimização, bases legais, contratos com operadores, retenção, controlos, revisão de privacidade | DPA/LGPD antes de piloto |
| R-04 | Mensagens WhatsApp em desconformidade | Verificar canal/fornecedor, opt-in, templates aprovados fora janela, tarifa e handoff | Política oficial e homologação |
| R-05 | Licenciamento de automações | n8n apenas operação interna pela AtlasHub, sem editor/builder aos clientes; licença por template e confirmação formal em casos ambíguos | Matriz de software de terceiros |
| R-06 | Custos/uso descontrolados | Orçamentos por tenant/run, medição tokens/mensagens, rate limits, alertas e suspensão | T14 |
| R-07 | Incidentes sem suporte | Runbooks, owner humano, alertas, fallback, teste de restore e rollback | T06, T11 |
| R-08 | Prometer serviço antes de estar pronto | Estados distintos pack-demo / role-pilot / deployment-active e linguagem Clara transparente | T13 |

## Fontes de verificação
- n8n SUL / serviços geridos: https://support.n8n.io/article/can-i-use-your-license-for-my-use-case
- WhatsApp Business policy: https://business.whatsapp.com/policy/preview?lang=pt_BR
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

## Decisões fechadas
D01 AI-WaaS é o projeto principal, PaperClip/atlas-si-os fora do escopo.
D02 Serviço comercial = função gerida e resultado operacional, não instalação.
D03 Preservar repositórios Agent Packs e App.AtlasHub.Si, sem cópias redundantes.
D04 Começar com ROLE-001 em staging, perfis 002/003 como demo.
D05 n8n não exposto ao cliente; nunca permitir automação configurável por utilizadores externos sem rever licença.
D06 Segurança e consentimento validados server-side antes de enviar mensagens a terceiros.

## Decisões dependentes de evidência
P01 VPS-alvo, CPU/RAM e redes: inventário.
P02 Calendário de teste/adaptador inicial: verificar interoperabilidade e dados sintéticos.
P03 Identidade e Supabase: auditar projeto e evitar mistura entre produtos.
P04 Fornecedor WhatsApp autorizado: confirmar antes de piloto real.
P05 Preços e custos: medir primeiro.
P06 SLA e cobertura humana: decisão comercial.
P07 Retenção/DPA e bases legais por cliente: revisão jurídica e privacidade.
P08 Integração Hermes: optar pelo caminho mais simples que passe testes e minimize custos.
