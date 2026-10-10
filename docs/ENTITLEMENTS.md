# Entitlements e módulos (WORKSPACES-BE-002)

Implementa a decisão de 09/10/2026: convenção `module.<nome>` aceite e entitlements verificados no backend, no worker e no tool gateway. Sem migrations: usa `commerce_entitlement` (migration 006, fonte `grant` já prevista no `CHECK`).

## Contrato
- `packages/contracts/modules.json` (v1.0.0): `workforce` (ROLE-001..008), `ami` (`ami.*`), `community` (`community.*`), `media` (`media.*`).
- `packages/contracts/entitlements.ts`: funções puras (`activeKeys`, `modulesOf`, `allowsRole`, `allowsTool`, `enforcing`).
- `packages/db/entitlements.ts`: `loadEntitlements(tx, tenantId)` lê dentro do contexto RLS do tenant e resolve `mission.<template>`/`product.<id>` para o role vendido.
- OpenAPI publicado 0.3.0: `GET /v1/me`, `GET /v1/entitlements`, `POST /v1/ops/entitlements`, `POST /v1/ops/entitlements/revoke`.

## Regras
| Chave ativa | Efeito |
|---|---|
| `module.<m>` | Liga o módulo; cobre os roles e prefixos de tools listados em `modules.json` |
| `mission.<template>` | Liga Workforce e cobre só o role do template |
| `product.<id>` com `roleId` | Liga Workforce e cobre só esse role |

Ativa = `status = active`, `validFrom ≤ agora < validUntil` (ou sem fim).

## Pontos de verificação (`ENTITLEMENTS_ENFORCE=1`)
| Ponto | Sem entitlement |
|---|---|
| `POST /v1/deployments` | 403 `entitlement_required` |
| `POST /v1/inbound/:provider` | Run guardado (idempotente) em `suspended`, motivo `entitlement_missing`, nunca entra na fila |
| Worker (`execute`) | Run `blocked`, motivo `entitlement_expired`, evento `policy.denied`, sem efeitos |
| Tool gateway (`engine.call`) | `RolePolicyError('entitlement_missing')` para tools de módulo (`ami.*`, …) |

Sem a flag, o comportamento é o anterior (compatível com staging). A CI corre a API e o worker com a flag ligada e todas as suites passam.

Diferença face ao plano em `docs/workspaces/03`: **não** há exceção para o house tenant nem para deployments `sandbox`. Os guardrails só se apertam; os tenants sintéticos recebem `module.workforce` por seed.

## Concessão
Só `atlas_owner`/`atlas_operator` com membership no tenant. Tenant admins não se concedem módulos. Fonte `grant`, `sourceId = ops`, auditado (`entitlement.grant` / `entitlement.revoke`). A revogação atinge só a linha `sourceId = ops`; outras concessões (seeds, encomendas, subscrições, trials) mantêm-se.

## Tenants sintéticos do piloto (`scripts/seed-pilots.mjs`, só `waas_staging`)
`pilot-a-sandbox`, `pilot-b-sandbox`, `pilot-c-sandbox`, `atlas-synthetic-qa`, com nomes genéricos e utilizadores `<tenant>:admin`/`<tenant>:viewer`. O mapeamento para organizações reais vive no repositório privado de operações.

## Testes
- `tests/entitlements.test.mjs` (unitários, 5).
- `tests/entitlements.e2e.mjs` (7): leitura só do próprio tenant, `/v1/me`, isolamento entre pilotos e A/B, concessão/revogação auditada, 403 em deployments, inbound `suspended`, worker `blocked` após revogação.
