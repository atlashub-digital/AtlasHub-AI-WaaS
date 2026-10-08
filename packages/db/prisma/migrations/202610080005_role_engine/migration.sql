-- Round 2: generic role engine. Sandbox records emulate each tenant's external systems
-- (CRM, mailbox, listings, orders, ledger, ATS) for ROLE-002..008 in staging.
CREATE TABLE "public"."SandboxRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SandboxRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SandboxRecord_tenantId_kind_key_key" ON "public"."SandboxRecord"("tenantId", "kind", "key");
CREATE INDEX "SandboxRecord_tenantId_kind_idx" ON "public"."SandboxRecord"("tenantId", "kind");
ALTER TABLE "SandboxRecord" ADD FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id);
ALTER TABLE "SandboxRecord" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "SandboxRecord" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "SandboxRecord" FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "SandboxRecord" FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "SandboxRecord" TO waas_runtime;
CREATE POLICY tenant_isolation ON "SandboxRecord" FOR ALL TO waas_runtime USING ("tenantId" = waas_tenant()) WITH CHECK ("tenantId" = waas_tenant());
CREATE POLICY platform_operator ON "SandboxRecord" FOR ALL TO waas_runtime USING (waas_scope() = 'platform') WITH CHECK (waas_scope() = 'platform');
