# MVP — 8 colaboradores digitais
Data: 2026-10-07. Situação: catálogo proposto; nenhum destes oito deve ser anunciado como operacional sem homologação.

## Princípios
Produto vendido = função gerida (não instalação de agentes). Cada role tem (a) entregáveis, (b) canais, (c) fontes de dados, (d) ferramentas autorizadas, (e) limites/aprovações, (f) métricas, (g) plano mensal e limites de volume, (h) runbook e humano responsável. Cada tenant tem deployment, políticas, credenciais e logs independentes.

| ID | Perfil / segmentos | Responsabilidades | Base técnica | Gate MVP |
|---|---|---|---|---|
| ROLE-001 | Rececionista Digital / clínicas, estética e serviços | FAQ, confirmação, reagendamento aprovado, handoff | PACK-001 + Atendimento.Center + n8n + Hermes opcional | 3 cenários E2E + A01-A08, sem conselhos clínicos |
| ROLE-002 | Assistente Comercial / serviços B2B | Qualificar leads, organizar CRM, follow-up autorizado, agendar | Hermes + n8n + CRM + Calendar | Conformidade de comunicação, dedupe e aprovação de campanhas |
| ROLE-003 | Secretária Administrativa / pequenas empresas | Etiquetar emails, sugerir respostas, reuniões e briefs | Hermes + n8n + Gmail/Calendar | Draft-only por padrão; envio sujeito a aprovação |
| ROLE-004 | Consultor Imobiliário Digital / imobiliárias | Perguntas sobre imóveis, leads, visitas, handoff | Hermes + base de imóveis + n8n | Não inventar disponibilidade/preço, aprovação de ofertas |
| ROLE-005 | Assistente E-commerce / lojas | FAQ, consulta de estado de pedido, pós-venda, handoff | n8n + loja/ERP + Atendimento.Center | Acesso de leitura; reembolso só com aprovação |
| ROLE-006 | Assistente de Marketing / empresas | Pesquisa, calendário editorial, rascunhos de posts, relatórios | Hermes + n8n + CMS social | Aprovação humana antes de publicar e uso de conteúdo licenciado |
| ROLE-007 | Assistente Financeiro Administrativo / PMEs | Extração de faturas, cobranças administrativas, reconciliação preliminar | n8n + OCR/API + ERP | Nunca transferir fundos; aprovar comunicações sensíveis |
| ROLE-008 | Assistente de RH / empresas | Receber candidaturas, perguntas de processo, organizar entrevistas | n8n + Hermes + calendário | Sem classificação discriminatória ou decisão automática de contratação |

## Priorização executiva
**Agora:** ROLE-001, ROLE-002 e ROLE-003.
**Depois:** ROLE-004 e ROLE-005.
**Expansão:** ROLE-006, ROLE-007 e ROLE-008.

## Ficha obrigatória para promoção de catálogo
- Nome, versão, setor e proprietário da operação.
- Escopo claro: eventos, ações permitidas, ações proibidas, dados consultados.
- Canais, horários e volume mensal contratados; SLA mensurável.
- Pack versionado e mapa das ferramentas/regras.
- Custo estimado por tarefa e preço aprovado.
- Testes funcionais, de falha, prompt injection, isolamento e escalonamento.
- Onboarding, pausa, suporte, revogação, exportação e encerramento.
- Status: idea | demo | pilot | ga | retired, separado do status do pack.

## Critérios para ROLE-001 como produto operacional
1. Receber uma mensagem autorizada em sandbox e criar run identificável.
2. Confirmar disponibilidade em agenda real de teste sem inventar slots.
3. Confirmar ou propor remarcação segundo política aprovada.
4. Transferir exceções humanas sem aconselhamento clínico.
5. Guardar log sanitizado, custo, tempo e resultado por tenant.
6. Demonstrar falha segura e kill switch.
7. Passar testes A01–A08 no sistema real.
8. Só então ativar piloto contratual supervisionado.
