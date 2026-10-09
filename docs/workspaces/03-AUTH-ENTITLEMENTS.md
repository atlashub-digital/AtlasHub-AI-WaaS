# 03 — Autenticação, memberships, isolamento e entitlements

## 1. Autenticação (estado verificado em `services/api/src/auth.ts`)

| Item | Comportamento |
|---|---|
| Fonte de identidade | JWT `Authorization: Bearer`; `sub` é a identidade |
| Modo real | `AUTH_MODE=supabase`: verificação por JWKS (`JWT_JWKS_URL`) com `RS256`/`ES256`, `JWT_ISSUER` e `JWT_AUDIENCE` obrigatórios |
| Modo staging | `HS256` com segredo ≥ 32 chars; o arranque **falha** se `AUTH_MODE=staging` com `NODE_ENV=production` |
| Falha | 401 sem detalhe (`UnauthorizedException`) |

**Plano para o Workspaces:**
- O utilizador autentica-se no **Supabase Auth** (o mesmo projeto do Core) a partir do Workspaces, e o Workspaces envia o access token ao Core.
- **Decidido (Claude, FE+BE):** um BFF no servidor Next (route handlers/server actions), com o token em cookie `HttpOnly; Secure; SameSite=Strict` e refresh do lado do servidor. Evita CORS e mantém o token fora do JavaScript do browser.
- Chamadas diretas do browser ao Core não são usadas; se um dia forem precisas, exigem CORS com allowlist explícita (PR à parte).
- O Workspaces **não** cria utilizadores, **não** decide papéis e **não** guarda tokens em `localStorage`.

## 2. Memberships e papéis

`identity(req, tenantId?, write?)`:
1. Lê só as memberships **ativas do próprio `sub`** (RLS `own_memberships`).
2. Sem memberships → 403.
3. Mais do que uma e sem `?tenant=` → `403 Select a tenant`.
4. `write = true` exige `tenant_admin`, `atlas_operator`, `atlas_engineer` ou `atlas_owner`.

| Papel | Leitura do tenant | Decidir aprovações | Operação (`/v1/ops/*`, deployments) | Criar tenant |
|---|---|---|---|---|
| `tenant_user` | ✅ | ❌ | ❌ | ❌ |
| `tenant_admin` | ✅ | ✅ | ❌ | ❌ |
| `atlas_operator` / `atlas_engineer` | ✅ (só com membership no tenant) | ✅ | ✅ | ❌ |
| `atlas_owner` | ✅ (idem) | ✅ | ✅ | ✅ |

Não existe bypass global: um operador AtlasHub também precisa de membership no tenant. **O Workspaces deve esconder ações pela tabela acima, mas é o Core que decide** (403).

## 3. Isolamento por tenant

- A app liga-se como `waas_runtime` (sem `BYPASSRLS`, sem DDL). `assertRuntimeRole` recusa arrancar com uma role privilegiada.
- Cada pedido corre numa transação com `app.tenant_id`, `app.user_id` e `app.scope`. O `?tenant=` do cliente só seleciona entre as suas memberships e nunca é autoridade.
- Evidência: suites `runtime-rls` 6/6 e `database-security` 2/2, e o `contract-probe` com 403 em leitura cruzada A→B ([01 §3](01-AUDITORIA.md)).

## 4. Entitlements — estado e plano

**Estado verificado:**

| Onde | O quê |
|---|---|
| `POST /v1/ops/trials/{id}/approve` | Cria `commerce_entitlement` `mission.<templateId>` (fonte `trial`, com `validUntil`) |
| `packages/commerce/settle.ts` (pagamento ou total 0) | `upsert` de `mission.<templateId>` ou `product.<id>` (fonte `subscription` ou `order`) |
| worker `billing.ts` | Expira entitlements de trials terminados |
| **Verificação** | **Nenhuma.** Nenhuma rota e nenhum ponto do worker lê `commerce_entitlement` |

**Plano (sem migration destrutiva):**

1. **Leitura — PR-E.** `GET /v1/entitlements?tenant=` devolve os itens com `status = active` e `validFrom ≤ now < validUntil` (ou sem fim), mais os `modules` derivados:
   - `workforce` se existir qualquer `mission.*` ativo **ou** qualquer deployment no tenant (compatível com os tenants sintéticos e de piloto atuais);
   - `ami` se existir `module.ami` ativo.
2. **Convenção de chaves**, documentada e sem alterar o schema:
   - `mission.<templateId>`
   - `product.<productId>`
   - `module.<workforce|ami|…>`, nova, criada por operador com a fonte `grant`
   - A migration 006 já prevê `grant` no `CHECK` de `source` (`'order','subscription','trial','grant'`) e `revoked` em `status`, por isso **não precisa de migration**. A concessão fica auditada em `AuditEvent`.
3. **Concessão manual — PR-E.** `POST /v1/ops/entitlements` para `atlas_owner`/`atlas_operator`, com membership e auditoria. Permite ligar o AMI a um tenant piloto sem passar pelo funil comercial.
4. **Aplicação (enforcement) — PR-F, depois do G2.**
   - `POST /v1/deployments` exige um entitlement ativo que cubra o `roleId`/template, exceto para o house tenant e para deployments `sandbox` de demonstração.
   - O worker passa runs a `suspended` (o estado já existe) quando o entitlement expira.
   - É uma mudança de comportamento, por isso vem com testes negativos A/B e flag de ativação.

## 5. Onboarding de utilizadores de cliente (lacuna registada)

Hoje, `quotes/accept` e `trials/approve` criam o tenant **sem nenhum utilizador**. A membership só é criada por um operador com `POST /v1/tenants/{id}/memberships`, usando o UUID de `auth.users`.

Proposta para depois do G2: convite por email com token de uso único (hash em DB) que, ao ser aceite com login Supabase, cria a membership `tenant_admin`. Exige uma tabela aditiva `tenant_invitation` com RLS e fica fora deste ciclo.
