-- All tenant-bearing references must match the owning tenant.
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_tenant_id_unique" UNIQUE ("tenantId",id);
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_tenant_id_unique" UNIQUE ("tenantId",id);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenant_id_unique" UNIQUE ("tenantId",id);
ALTER TABLE "Deployment" ADD FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id);
ALTER TABLE "Deployment" ADD FOREIGN KEY ("roleId") REFERENCES "Role"(id);
ALTER TABLE "Deployment" ADD FOREIGN KEY ("packReleaseId") REFERENCES "PackRelease"(id);
ALTER TABLE "ToolGrant" ADD FOREIGN KEY ("tenantId","deploymentId") REFERENCES "Deployment"("tenantId",id);
ALTER TABLE "ChannelBinding" ADD FOREIGN KEY ("tenantId","deploymentId") REFERENCES "Deployment"("tenantId",id);
ALTER TABLE "TaskRun" ADD FOREIGN KEY ("tenantId","deploymentId") REFERENCES "Deployment"("tenantId",id);
ALTER TABLE "CalendarSlot" ADD FOREIGN KEY ("tenantId","appointmentId") REFERENCES "Appointment"("tenantId",id);
ALTER TABLE "TaskEvent" ADD FOREIGN KEY ("tenantId","runId") REFERENCES "TaskRun"("tenantId",id);
ALTER TABLE "Approval" ADD FOREIGN KEY ("tenantId","runId") REFERENCES "TaskRun"("tenantId",id);
ALTER TABLE "UsageRecord" ADD FOREIGN KEY ("tenantId","runId") REFERENCES "TaskRun"("tenantId",id);
ALTER TABLE "ToolEffect" ADD FOREIGN KEY ("tenantId","runId") REFERENCES "TaskRun"("tenantId",id);
ALTER TABLE "Incident" ADD FOREIGN KEY ("tenantId","deploymentId") REFERENCES "Deployment"("tenantId",id);
ALTER TABLE "Membership" ADD FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id);
ALTER TABLE "Appointment" ADD FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id);
ALTER TABLE "Deployment" ADD CHECK (state IN ('draft','sandbox','acceptance','pilot','active','paused','suspended','terminated'));
-- Supabase/PostgREST access is default deny. Backend is private; no client grants.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Tenant','Membership','Deployment','ToolGrant','ChannelBinding','TaskRun','TaskEvent','Approval','UsageRecord','Incident','AuditEvent','IntegrationConnection','Appointment','CalendarSlot','ToolEffect','Assessment'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon',t); END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON %I FROM authenticated',t); END IF;
 END LOOP;
END $$;
