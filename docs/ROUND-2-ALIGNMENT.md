# Round 2 — alinhamento com o pedido

**Data:** 2026-10-08 · **Autor:** Claude Code (lead técnico do Round 2)
Confronta o que o Founder pediu com o que está especificado (Charter, Executive Brief, PRD, Arquitetura) e com o que existe em código.

## 1. Estamos a construir o que foi pedido?

| Pedido | Especificação | Estado real | Veredicto |
|---|---|---|---|
| Colaboradores digitais **geridos** pela AtlasHub | Executive Brief, D02 | Control plane, worker, ROLE-001 determinístico, operador humano nas exceções | ✅ alinhado |
| Primeira Rececionista Digital em staging remoto | Round 2 DoD | API/worker em staging remoto; 16/16 testes em remoto; falta Auth real, RLS no caminho real, n8n e canal de teste | 🟡 em curso (G1) |
| Montra com simulação e catálogo | R3, FR-11 | App: Clara roteirizada, 3 simuladores, catálogo de 8 roles, assessment | ✅ base existe |
| Portal do cliente | FR-10 | Portal com JWT sintético; falta login Supabase real | 🟡 G3 |
| Captação de leads e pipeline comercial | PRD F01 (só "Lead → assessment → proposta") | Só uma tabela `Assessment` sem tenant nem estado | ❌ **novo** — desenhado em [DATA-MODEL-v2](DATA-MODEL-v2.md) |
| Produtos, serviços, planos, faturação, acessos por assinatura | PRD: `ServicePlan`, `Subscription`; **WON'T Round 1: billing automático, pagamentos** | Não existe | ❌ **novo** — desenhado; implementação por fases |
| Webhooks de pagamento | Fora do Round 1 | Não existe | ❌ **novo** — desenhado |
| Clara como **IA** concierge | Clara determinística; "não introduzir LLM sem justificação" | Roteirizada, sem LLM | ⚠️ **mudança de âmbito** — desenhado com guardrails, custo e transparência |
| Alocação de agentes a missões standard/moduláveis | Role + Deployment + ServicePlan | Deployment existe; Mission não | ❌ **novo** — desenhado como `Mission` |
| Multilíngue | Não especificado (`locale` só nos packs) | Tudo em PT | ❌ **novo** — i18n desde o modelo |
| Escala mundial | "usar infraestrutura disponível no MVP" | Staging numa VPS; Supabase pequeno (60 ligações) | ⚠️ desenhado para crescer; não é escala mundial hoje |

**Conclusão:** o núcleo operacional está alinhado. O que pediste agora acrescenta a **camada comercial** (leads, catálogo, missões, faturação, pagamentos, acessos), a **Clara com IA** e o **multilíngue**. Estão desenhados desde já no modelo de dados e implementam-se por fases, sem bloquear o piloto da ROLE-001.

## 2. Pontos onde é preciso decidir ou corrigir

1. **"Trabalho temporário" — usar só como metáfora comercial, nunca como enquadramento jurídico.** Em Portugal e no Brasil, "trabalho temporário" é uma atividade regulada (licença de empresa de trabalho temporário, cedência de *trabalhadores*). O README já diz que a AtlasHub *não* é uma agência de trabalho temporário. Proposta: no produto e nos contratos, usar "**alocação de colaboradores digitais a missões**" (serviço gerido). No marketing pode dizer-se "como um trabalhador temporário, mas digital", com revisão jurídica.
2. **Pagamento ≠ ativação.** A Arquitetura exige "não ativar automaticamente após pagamento". O desenho separa **acessos** (portal, simulações premium, créditos), que o pagamento liberta automaticamente, da **ativação de um colaborador** em produção, que continua a exigir testes de aceitação e aprovação humana.
3. **Faturação legal.** Em Portugal as faturas têm de ser emitidas por software certificado pela AT; no Brasil por NFS-e municipal. O desenho guarda a faturação comercial e **integra um emissor certificado** (o documento legal fica referenciado), em vez de a plataforma emitir faturas legais.
4. **Clara com IA.** Obriga a: aviso de que é uma IA (transparência, AI Act), consentimento antes de recolher dados de contacto, limite de custo por sessão e por dia, nenhuma promessa de preço ou resultado fora do catálogo aprovado, e passagem para um humano.
5. **Escala.** O desenho prepara a escala (IDs ordenados no tempo, região por tenant, particionamento das tabelas de eventos, API/worker sem estado, pooler). A infraestrutura atual serve staging e pilotos; para produção aberta é preciso subir o plano Supabase e orquestrar os containers.

## 3. Ordem de execução proposta
1. **G1 (agora):** Supabase como base e Auth do control plane; role de runtime mínima; RLS por tenant no caminho real; testes A/B.
2. **Fase B:** catálogo + i18n + CRM (leads, importação, pipeline, cadências) + captação pela Clara (ainda determinística).
3. **G2:** ROLE-001 com n8n e inbox de teste (o piloto não espera pela camada comercial).
4. **Fase C:** planos, subscrições, acessos, faturas, webhooks de pagamento (sandbox do provider).
5. **Fase D:** missões e alocação; Clara com LLM atrás de feature flag.

## 4. Decisões que preciso do Founder
| # | Decisão | Proposta por defeito |
|---|---|---|
| D-A | Mercados e línguas iniciais | pt-PT, pt-BR, en; es depois |
| D-B | Providers de pagamento | Stripe (cartão, SEPA, global) + um local por mercado (PIX no BR; MB WAY/Multibanco em PT) |
| D-C | Emissor de faturas certificado | PT: um software certificado AT com API; BR: emissor NFS-e com API |
| D-D | Moedas | EUR, BRL, USD |
| D-E | Clara com LLM | Sim, atrás de feature flag, com limite de custo e aviso de IA |
| D-F | Residência de dados | Uma região no início; campo `region` por tenant desde já |
