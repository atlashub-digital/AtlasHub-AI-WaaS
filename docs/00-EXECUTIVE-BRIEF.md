# AtlasHub AI Workforce — Executive Brief
**Versão 1.0 · 07/10/2026 · Estado: especificação pronta para desenvolvimento, não sistema operacional**

## Tese
A AtlasHub.SI vende **serviços profissionais digitais geridos**, não instala agentes e não disponibiliza uma interface de automação aos clientes. O cliente define objetivos e processos, autoriza sistemas e recebe atividades, indicadores, suporte e supervisão. A AtlasHub é a operadora contínua, com humanos responsáveis por exceções e pela governança.

## Resultados pretendidos no primeiro round de desenvolvimento
**R1 (obrigatório):** um vertical slice completo em staging, da mensagem recebida até à execução auditada de uma tarefa administrativa real numa agenda de teste, incluindo um evento de aprovação/handoff, sem acesso a dados reais de pacientes.
**R2 (obrigatório):** backend control plane utilizável, login/autorização multi-tenant, provisionamento de deployment, tarefas, usage, incidentes e pausa, API documentada e CI verde.
**R3 (obrigatório):** Clara e App.AtlasHub.Si mostram o catálogo de serviços geridos e conduzem para avaliação/proposta, preservando o simulador V0.
**R4 (obrigatório):** ROLE-001 pilot-ready em staging; ROLE-002 e ROLE-003 com contratos de função, packs de demonstração e testes, mas **não anunciados como operacionais**.
**R5 (obrigatório):** scripts de deploy staging, restore/rollback, observabilidade mínima, threat model e evidências de testes.
**R6 (condicional):** piloto com canal WhatsApp real, apenas mediante aceite da política da plataforma, avaliação de privacidade, autorização do titular, responsável humano e integração homologada.

## Limites
Não construir oito agentes de produção no primeiro round. O catálogo estratégico tem 8 perfis; executar apenas 1 serviço real e preparar outros 2. Sem PaperClip, OpenClaw, shell autónomo, scraping de dados pessoais, faturação automática ou provisionamento real sem aprovação.

## Artefactos existentes
- `atlas-agent-packs`: 1 PACK-001 em estado demo, 5 ferramentas definidas em JSON, três cenários e testes de aceitação definidos; workflows n8n reais ausentes conforme INDEX.
- `App.AtlasHub.Si`: simulador V0, Clara roteirizada, sem backend nem LLM; testes descritos mas deploy não certificado.
- `AtlasHub-AI-WaaS`: documentação e issues; implementação operacional ainda não verificada.

## Responsabilidade
Owner do negócio aprova preços, contratos, riscos e passagem a produção. Codex implementa em branches/PRs. Operador AtlasHub faz handoff, monitoriza, acompanha e responde a incidentes.

## Medida de conclusão
Ver `03-ACCEPTANCE-AND-TESTS.md`. Um sprint não está concluído com documentação ou screenshots apenas: exige execução E2E, testes de segurança, CI e demonstração reproduzível.
