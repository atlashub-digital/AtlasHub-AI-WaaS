-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commercialState" TEXT NOT NULL DEFAULT 'demo',

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PackRelease" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "PackRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deployment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "packReleaseId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'sandbox',
    "config" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ToolGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "policy" JSONB NOT NULL,

    CONSTRAINT "ToolGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChannelBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "inboxExternalId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "ChannelBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "costEstimate" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "safePayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Approval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "requestedAction" TEXT NOT NULL,
    "safeContext" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "assigneeId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedCost" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Incident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "runId" TEXT,
    "severity" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "ownerId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationRef" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CalendarSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "appointmentId" TEXT,

    CONSTRAINT "CalendarSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ToolEffect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Assessment" (
    "id" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "need" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "public"."Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "public"."Role"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PackRelease_packId_version_sha_key" ON "public"."PackRelease"("packId", "version", "sha");

-- CreateIndex
CREATE INDEX "Deployment_tenantId_idx" ON "public"."Deployment"("tenantId");

-- CreateIndex
CREATE INDEX "ToolGrant_tenantId_idx" ON "public"."ToolGrant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolGrant_deploymentId_toolId_key" ON "public"."ToolGrant"("deploymentId", "toolId");

-- CreateIndex
CREATE INDEX "ChannelBinding_tenantId_idx" ON "public"."ChannelBinding"("tenantId");

-- CreateIndex
CREATE INDEX "TaskRun_tenantId_state_startedAt_idx" ON "public"."TaskRun"("tenantId", "state", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskRun_deploymentId_idempotencyKey_key" ON "public"."TaskRun"("deploymentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TaskEvent_tenantId_runId_idx" ON "public"."TaskEvent"("tenantId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_runId_key" ON "public"."Approval"("runId");

-- CreateIndex
CREATE INDEX "Approval_tenantId_idx" ON "public"."Approval"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_runId_key" ON "public"."UsageRecord"("runId");

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_idx" ON "public"."UsageRecord"("tenantId");

-- CreateIndex
CREATE INDEX "Incident_tenantId_idx" ON "public"."Incident"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "public"."AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_tenantId_idx" ON "public"."IntegrationConnection"("tenantId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_idx" ON "public"."Appointment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_tenantId_conversationRef_key" ON "public"."Appointment"("tenantId", "conversationRef");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSlot_appointmentId_key" ON "public"."CalendarSlot"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSlot_tenantId_startsAt_key" ON "public"."CalendarSlot"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "ToolEffect_tenantId_idx" ON "public"."ToolEffect"("tenantId");

