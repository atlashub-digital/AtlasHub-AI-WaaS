# AtlasHub AI Workforce — Employee Factory
**Versão:** 1.0 | **Data:** 2026-10-07 | **Estado:** Projeto aprovado para planeamento técnico; produção não validada

## 1. Visão e tese
A AtlasHub.SI passa a oferecer AI Workforce as a Service (AI-WaaS): funções empresariais realizadas por agentes digitais geridos pela AtlasHub, com implantação, execução, observabilidade, assistência, evolução e prestação de contas. **Não vendemos software instalado nem cedemos trabalhadores humanos.** Vendemos prestação continuada de serviços digitais com âmbito e níveis de serviço contratados.

### Promessa
«Reforce a sua equipa com colaboradores digitais operados pela AtlasHub.» O cliente define objetivos, autoriza integrações, acompanha entregas e mantém controlo sobre decisões sensíveis; AtlasHub assegura operação técnica e gestão de exceções.

### O que o cliente compra
1. Uma capacidade operacional delimitada por função, horários, canais, volume, regras e objetivos.
2. Onboarding com aprovação de processos, acessos e parâmetros.
3. Execução diária do serviço; supervisão, monitorização, suporte e manutenção.
4. Relatórios de trabalho realizado, qualidade, exceções e tempo de resposta.
5. Escalonamento para pessoas autorizadas sempre que necessário.

### O que NÃO prometemos
Emprego humano, autonomia irrestrita, substituição integral de trabalhadores, resultados comerciais garantidos, respostas clínicas/jurídicas/financeiras profissionais ou operação sem intervenção humana.

## 2. Estratégia de produto
- **Unidade técnica (Pack):** instruções, fluxos, tools, cenários, testes e guardrails versionados em `atlas-agent-packs`.
- **Perfil comercial (Digital Employee Role):** função, entregáveis, limites, experiência, SLA e preço em `AtlasHub-AI-WaaS`.
- **Contrato operacional (Service Subscription):** um cliente contrata uma função e recebe uma instância isolada (Employee Deployment) monitorizada.
- **Experiência comercial:** Clara qualifica, demonstra, recolhe necessidades e agenda avaliação; a aplicação nunca anuncia simulação como execução real.

## 3. Segmentos prioritários
Clínicas/estética: confirmações, reagendamento e follow-up administrativo (sem orientação médica).
Imobiliárias: receção de leads, qualificação, agendamento de visitas.
Varejo/e-commerce: dúvidas frequentes, estado de pedidos, handoff.
Serviços B2B: triagem comercial, agenda e CRM.
Escritórios profissionais: gestão administrativa autorizada, sem aconselhamento regulamentado.

## 4. MVP comercial
**Primeira oferta:** Rececionista Digital Gerida — versão clínica administrativa baseada no PACK-001.
O cliente recebe triagem de mensagens, confirmações de consultas, propostas de remarcação dentro de regras, registos e encaminhamento humano. Canais e volume só entram no contrato após teste das integrações efetivas.

**Segundo produto:** Assistente Comercial Digital — leads, triagem e CRM.
**Terceiro:** Secretária Digital — agenda e rotinas administrativas.
Marketing e imobiliário entram após os três primeiros terem runbooks replicáveis.

## 5. Modelo comercial
- Taxa inicial de ativação: desenho de processo, integração, testes e formação dos responsáveis.
- Mensalidade gerida: disponibilidade contratada, monitorização, manutenção, melhorias pequenas e suporte.
- Consumos excedentes: canais, mensagens, chamadas, ferramentas externas e volume acima de franquias.
- Alterações grandes: proposta separada.
- Planos sugeridos: Essential (uma função, um canal e limites baixos); Business (mais canais e integrações); Managed+ (maior SLA, analítica e revisão operacional). Preços reais dependem de custos medidos e teste de mercado.
- Contrato deve definir titularidade dos dados, responsabilidades, direitos de acesso, retenção, incidente, saída/exportação, autorização para automações e suspensão.

## 6. Clara e o funil
1. Descobrir setor, problema, volume, sistemas e responsável.
2. Apresentar função e limites de modo transparente.
3. Executar simulação fictícia rotulada como tal; ROI é hipótese.
4. Recolher consentimento e agendar AI Business Assessment.
5. Gerar proposta de prestação de serviços com escopo e preço calculado.
6. Aprovação e contratação.
7. Ativação técnica com testes e homologação.
8. Operação, relatório mensal, melhoria e renovação.

## 7. Entregáveis, não «agentes mágicos»
Cada oferta exige: ficha do serviço; pack/versão; matriz de ferramentas; SOP de operação; limites e aprovações; custos unitários; cenários de aceitação; política de fallback; contrato/SLA; painel de métricas; processo de cancelamento.

## 8. Equipa e responsabilidades propostas
- Patrocinador / decisão comercial: direção AtlasHub.
- Product Owner AI-WaaS: backlog, margens, catálogo e prioridades.
- Engenharia (Claude Code/Codex): integração e automações.
- Operações AI-WaaS (operador responsável + ferramentas do próprio projeto): ativação, monitorização, incidentes, escalonamento e relatórios. Sem dependência do PaperClip.
- Clara: discovery, demo e encaminhamento comercial; sem promessas não aprovadas.
- Segurança/privacidade e jurídico: aprovação de canais, acessos, termos e LGPD.

## 9. Indicadores
MRR, margem de contribuição por contrato, CAC, conversão demonstração→proposta→cliente, tempo de ativação, taxa de sucesso das tarefas, intervenções humanas, falhas por 1.000 tarefas, latência, custo por tarefa, satisfação e retenção. Não afirmar economias sem medição.

## 10. Critérios de lançamento
Pelo menos um pack com integração real homologada, tenant isolado, credenciais seguras, logs sem dados desnecessários, aprovação humana de exceções, telemetria, testes de recuperação, preços aprovados, contrato/SLA e suporte operacional. Sem isso, só vender piloto assistido e com escopo explícito.
