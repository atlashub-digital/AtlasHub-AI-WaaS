-- Proposed migration 007. Apply to the real AtlasHub database only after the Founder gate.
CREATE TABLE "Project" (
 id text PRIMARY KEY,
 "tenantId" text NOT NULL REFERENCES "Tenant"(id),
 slug text NOT NULL,
 name text NOT NULL,
 summary text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'sandbox' CHECK (status IN ('planning','sandbox','active','paused','archived')),
 modules text[] NOT NULL DEFAULT '{}' CHECK (modules <@ ARRAY['workforce','ami','community','media']::text[]),
 "supervisorUserId" text,
 "createdAt" timestamptz NOT NULL DEFAULT now(),
 "updatedAt" timestamptz NOT NULL DEFAULT now(),
 UNIQUE ("tenantId",slug),
 UNIQUE ("tenantId",id),
 FOREIGN KEY ("tenantId","supervisorUserId") REFERENCES "Membership"("tenantId","userId")
);
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Project" FROM PUBLIC;
DO $ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON "Project" FROM %I',role_name);
  END IF;
 END LOOP;
END $;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Project" TO waas_runtime;
CREATE POLICY tenant_isolation ON "Project" FOR ALL TO waas_runtime
 USING ("tenantId" = waas_tenant()) WITH CHECK ("tenantId" = waas_tenant());
CREATE POLICY platform_operator ON "Project" FOR ALL TO waas_runtime
 USING (waas_scope() = 'platform') WITH CHECK (waas_scope() = 'platform');
ALTER TABLE "Deployment" ADD COLUMN "projectId" text;
ALTER TABLE "Deployment" ADD CONSTRAINT deployment_project_tenant_fk
 FOREIGN KEY ("tenantId","projectId") REFERENCES "Project"("tenantId",id);
CREATE INDEX deployment_project_idx ON "Deployment"("tenantId","projectId");
