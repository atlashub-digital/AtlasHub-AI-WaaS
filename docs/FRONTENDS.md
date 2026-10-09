# Frontends ligados a esta API

Este documento liga o backend aos dois fronts públicos da AtlasHub. A documentação detalhada de cada lado vive na pasta `docs/` do respetivo repositório; aqui fica o que o **backend e a DB** têm de tratar.

| Front | Repositório | Documentação |
|---|---|---|
| Site institucional + Clara de pré-análise | `atlashub-digital/AtlasHub.Si` | `docs/INTEGRACAO-BACKEND.md`, `docs/BACKLOG-BACKEND.md` |
| App: painel, biblioteca, simuladores, assessment, portal | `atlashub-digital/App.AtlasHub.Si` | `docs/INTEGRACAO-BACKEND.md`, `docs/MAPA-DADOS-ECRAS.md`, `docs/BACKLOG-BACKEND.md` |

## 1. O que os fronts chamam hoje

| Front | Chamada | Endpoint desta API | Compatível? |
|---|---|---|---|
| Site | `POST /api/lead` → webhook genérico (`Bearer`, `Idempotency-Key`, espera `202 {id, route:"human"}`) | nenhum equivalente direto (`/v1/public/leads` tem outro schema e devolve `{status}`) | ❌ precisa de endpoint servidor-a-servidor (ver §3) |
| App | Assessment | `POST /v1/assessments` | ✅ schema igual — mas sem contacto nem tenant |
| App | Login | Supabase Auth password grant (fora desta API); JWT ES256 aceite pela API | ✅ |
| App | Portal | `GET /v1/runs`, `/v1/approvals`, `/v1/usage`, `POST /v1/approvals/{id}/decide` | ✅ |

Nenhum dos fronts tem variáveis de ambiente de backend configuradas em produção (2026-10-09): **a API não está ligada a nenhum front em produção**.

## 2. Pré-requisitos de plataforma

1. **Ingress HTTPS** para a API (hoje só loopback no host de staging). Expor só `/health`, `/v1/public/*`, `/v1/assessments` e as rotas autenticadas de cliente; manter `/v1/ops/*` fora do ingress público ou atrás de allowlist.
2. **Rate limit atrás de proxy**: o limite de 120 POST/min é por IP direto; os pedidos dos fronts chegam pelos IPs da Vercel. Configurar proxy de confiança e chave por cliente servidor.
3. **Ambientes**: staging ligado aos *Preview* da Vercel; produção só depois de homologação (decisão NO-GO do Round 1 continua válida para comercialização).

## 3. Trabalho pedido ao backend (por prioridade)

| P | Tarefa | Notas |
|---|---|---|
| P0 | Endpoint versionado para leads do site (chave de serviço, aceita o payload atual, mapeia para `crm_*`, `Idempotency-Key`, responde `202 {id, route:"human"}`) | Mapeamento campo a campo em `AtlasHub.Si/docs/INTEGRACAO-BACKEND.md §3`. Decidir se lead só com WhatsApp é válido (hoje `email` é obrigatório). |
| P0 | Assessment com contacto e consentimento versionado — migrar para `/v1/public/leads` (`source: simulator`) ou nova versão de `/v1/assessments` | `Assessment` não tem `tenantId`, contacto, nem `crm_consent`. |
| P1 | `GET /v1/me` (perfil + memberships) | O portal pede hoje o tenant à mão. |
| P1 | Membership automática do utilizador ao aceitar proposta | `quotes/accept` cria o tenant mas não o utilizador. |
| P1 | Retenção/eliminação/exportação por titular e por tenant | LGPD/RGPD. |
| P2 | `GET /v1/dashboard?tenant=&from=&to=` com agregados | Especificação bloco a bloco em `App.AtlasHub.Si/docs/MAPA-DADOS-ECRAS.md`. Inclui métrica homologada de "tempo poupado". |
| P2 | Leitura de `IntegrationConnection` sem `secretRef` | Bloco "Integrações" do painel. |

## 4. Regras que os fronts já respeitam

- Chamadas só do servidor Next (BFF); JWT em cookie HttpOnly; nunca `service_role`.
- O front não decide tenant, permissões nem preços: mostra só preços `active` e o `disclaimer` das simulações.
- Os ecrãs Painel e Biblioteca são **ilustrativos** até haver fonte medida para cada número.
