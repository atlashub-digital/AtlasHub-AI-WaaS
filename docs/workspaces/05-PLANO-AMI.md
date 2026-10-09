# 05 — Plano de integração do AMI no Core

**Contexto (decisões em vigor, atlas-ops):**
- O AMI é um **módulo** do Workspaces, com coletores especializados. Não tem control plane nem portal próprio, e `ami.atlashub.si` é apenas uma porta contextual (deep link).
- A missão `AMI-001` (Max) adapta o coletor (`fbl.py`) para a saída normalizada **`ami.ads.v1`**, com custo observável e um teto de **3 USD/mês** (ATL-D17).
- Gate G3: nada de scraping fora da via autorizada e nenhum gasto sem conformidade e limite.

## 1. Princípio

Reutilizar o motor que já existe e está testado (deployments → runs → tool gateway com política → approvals → usage → audit) em vez de criar um serviço AMI. O coletor do Max continua no seu runtime (Hermes/n8n); o Core **orquestra, autoriza, mede e guarda**.

## 2. Encaixe no modelo atual

| Conceito AMI | Peça existente no Core | Alteração |
|---|---|---|
| "Ligar o AMI" a um tenant | `commerce_entitlement` `module.ami` (fonte `grant` ou `subscription`) | Nenhuma no schema (convenção de chave, [03 §4](03-AUTH-ENTITLEMENTS.md)) |
| Coletor AMI | **Role/Pack no catálogo único** (ex.: `ROLE-009` / `PACK-009 ami-collector` no `atlas-agent-packs`) | Novo pack. **Não** é um segundo catálogo: é uma linha no mesmo `Role`/`PackRelease` |
| Instância por cliente | `Deployment` (`sandbox` até à homologação) com `limits` (`monthlyBudgetUsd`, `dailyRuns`) | Nenhuma (são JSON) |
| Pedido de recolha | `TaskRun` via `POST /v1/inbound/{provider}` (assinado) ou disparo de operador | Idem |
| Execução | Tool `ami.collect` no gateway, política **`approval`** (há custo): cria `Approval` com resumo e custo estimado; depois da aprovação, chama o n8n como o `research.collect` da ROLE-006 (`callN8nTool`, HMAC + `Idempotency-Key`) | Novo módulo de role em `packages/roles` (padrão r006) |
| Custo observável | `UsageRecord` `metric = ami_provider_usd` (no padrão de `role_action`, `calendar_mutation`), `estimatedCost`, `currency = USD` por run | Nenhuma no schema |
| Teto | O worker bloqueia (`blocked`, motivo `budget_exceeded`) quando `sum(estimatedCost)` do mês ≥ `limits.monthlyBudgetUsd` | Lógica nova + teste |
| Resultado | `TaskRun.result` com `{ schema: "ami.ads.v1", count, sample, datasetRef }` (resumo; nunca dados pessoais) | Nenhuma |
| Dados completos | **Fase 2** (depois do G3): tabela aditiva `ami_dataset`/`ami_item` com `tenantId` e RLS, ou objeto em storage referenciado por `datasetRef` | Migration **aditiva**, com aprovação classe D |
| Auditoria | `AuditEvent` em aprovação, concessão e pausa | Já existe |

## 3. Fases

| Fase | Gate | Entrega | Dados |
|---|---|---|---|
| A0 | G2 | `module.ami` aparece em `GET /v1/entitlements`; o Workspaces mostra o placeholder | nenhum |
| A1 | G3 | `PACK-009` em `demo` com cenários e fixture `ami.ads.v1` **fictícia**; role engine com `ami.collect` + approval + usage + teto; testes A/B | sintéticos |
| A2 | G3 + classe D | Workflow n8n `ami-collector/ami-collect` chama o coletor do Max; 1 corrida real autorizada (≈ 0,14 USD), com custo em `UsageRecord` | reais, autorizados |
| A3 | G4 | Leitura no Workspaces (`GET /v1/ami/datasets?tenant=`) e armazenamento definitivo | reais |

## 4. Contrato `ami.ads.v1` (proposta ao Max, a fechar na AMI-001)

```jsonc
{ "schema": "ami.ads.v1", "collectedAt": "ISO-8601", "source": "meta_ad_library",
  "query": { "terms": ["…"], "country": "BR", "limit": 50 },
  "cost": { "provider": "apify", "usd": 0.14, "units": 1 },
  "items": [{ "adId": "…", "pageName": "…", "startedAt": "…", "platforms": ["facebook"], "creativeText": "…", "url": "…" }] }
```

Regras: só dados públicos de anúncios, sem dados pessoais de terceiros; `cost` obrigatório; o Core rejeita (`tool_failed`) saídas que não validem o schema.

## 5. O que este plano evita

- Um segundo catálogo de Workers ou um "AMI backend".
- Acoplar o produto a um runtime único: o tool chama o n8n por contrato HTTP assinado, e trocar o n8n pelo Hermes muda só o adaptador.
- Gasto sem aprovação: política `approval` mais o teto no worker.
