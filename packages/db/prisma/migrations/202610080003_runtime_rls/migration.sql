-- Round 2 / G1: least-privilege runtime role and tenant-scoped RLS on the real backend path.
-- The application connects as waas_runtime (no BYPASSRLS, no DDL, not table owner).
-- Each transaction declares its context with set_config(..., true):
--   app.tenant_id  tenant the request is bound to
--   app.user_id    authenticated subject (membership lookup before tenant is known)
--   app.scope      narrow pre-tenant lookups: platform | inbound | resolve | worker | public_intake
-- Owner/migration connections are unaffected (RLS is not forced), so migrations, seed and tests keep working.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='waas_runtime') THEN CREATE ROLE waas_runtime NOLOGIN NOINHERIT; END IF;
END $$;
ALTER ROLE waas_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;

CREATE OR REPLACE FUNCTION waas_tenant() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant_id', true), '') $$;
CREATE OR REPLACE FUNCTION waas_user() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
CREATE OR REPLACE FUNCTION waas_scope() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.scope', true), '') $$;
REVOKE ALL ON FUNCTION waas_tenant(), waas_user(), waas_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION waas_tenant(), waas_user(), waas_scope() TO waas_runtime;

GRANT USAGE ON SCHEMA public TO waas_runtime;

DO $$ DECLARE t text; BEGIN
 -- Tenant-owned tables: full DML, isolated by tenant; platform operators act with explicit scope.
 FOREACH t IN ARRAY ARRAY['Membership','Deployment','ToolGrant','ChannelBinding','TaskRun','TaskEvent','Approval','UsageRecord','Incident','AuditEvent','IntegrationConnection','Appointment','CalendarSlot','ToolEffect'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO waas_runtime', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL TO waas_runtime USING ("tenantId" = waas_tenant()) WITH CHECK ("tenantId" = waas_tenant())', t);
  EXECUTE format('DROP POLICY IF EXISTS platform_operator ON %I', t);
  EXECUTE format('CREATE POLICY platform_operator ON %I FOR ALL TO waas_runtime USING (waas_scope() = ''platform'') WITH CHECK (waas_scope() = ''platform'')', t);
 END LOOP;
END $$;

-- Tenant row itself.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON "Tenant" TO waas_runtime;
DROP POLICY IF EXISTS tenant_self ON "Tenant";
CREATE POLICY tenant_self ON "Tenant" FOR SELECT TO waas_runtime USING (id = waas_tenant());
DROP POLICY IF EXISTS platform_operator ON "Tenant";
CREATE POLICY platform_operator ON "Tenant" FOR ALL TO waas_runtime USING (waas_scope() = 'platform') WITH CHECK (waas_scope() = 'platform');

-- Narrow pre-tenant lookups (read only).
DROP POLICY IF EXISTS own_memberships ON "Membership";
CREATE POLICY own_memberships ON "Membership" FOR SELECT TO waas_runtime USING ("userId" = waas_user());
DROP POLICY IF EXISTS inbound_resolve ON "ChannelBinding";
CREATE POLICY inbound_resolve ON "ChannelBinding" FOR SELECT TO waas_runtime USING (waas_scope() = 'inbound');
DROP POLICY IF EXISTS deployment_resolve ON "Deployment";
CREATE POLICY deployment_resolve ON "Deployment" FOR SELECT TO waas_runtime USING (waas_scope() = 'resolve');
DROP POLICY IF EXISTS worker_resolve ON "TaskRun";
CREATE POLICY worker_resolve ON "TaskRun" FOR SELECT TO waas_runtime USING (waas_scope() = 'worker');

-- Global catalogue: read only.
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PackRelease" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Role", "PackRelease" FROM PUBLIC;
GRANT SELECT ON "Role", "PackRelease" TO waas_runtime;
DROP POLICY IF EXISTS catalogue_read ON "Role";
CREATE POLICY catalogue_read ON "Role" FOR SELECT TO waas_runtime USING (true);
DROP POLICY IF EXISTS catalogue_read ON "PackRelease";
CREATE POLICY catalogue_read ON "PackRelease" FOR SELECT TO waas_runtime USING (true);

-- Public intake (assessment form): insert, read back only within the intake scope; platform reads all.
GRANT SELECT, INSERT ON "Assessment" TO waas_runtime;
DROP POLICY IF EXISTS intake ON "Assessment";
CREATE POLICY intake ON "Assessment" FOR ALL TO waas_runtime USING (waas_scope() IN ('public_intake','platform')) WITH CHECK (waas_scope() IN ('public_intake','platform'));

-- Migration bookkeeping stays private.
DO $$ BEGIN
 IF to_regclass('waas_migrations') IS NOT NULL THEN REVOKE ALL ON "waas_migrations" FROM waas_runtime; END IF;
END $$;
