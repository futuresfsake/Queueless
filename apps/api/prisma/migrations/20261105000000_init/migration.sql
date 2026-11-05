-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'CLINIC_ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'SERVED', 'SKIPPED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TICKET_ISSUED', 'CALLED', 'STARTED', 'SERVED', 'SKIPPED', 'NO_SHOW', 'CANCELLED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('STAFF', 'PATIENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_points" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_waiting" INTEGER NOT NULL DEFAULT 200,

    CONSTRAINT "service_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_point_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_counters" (
    "service_point_id" UUID NOT NULL,
    "queue_date" DATE NOT NULL,
    "tenant_id" UUID NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_counters_pkey" PRIMARY KEY ("service_point_id","queue_date")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_point_id" UUID NOT NULL,
    "slot_id" UUID,
    "queue_date" DATE NOT NULL,
    "seq" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'WAITING',
    "patient_name" TEXT,
    "phone" TEXT,
    "access_token" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "called_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "called_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_point_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "type" "EventType" NOT NULL,
    "actor_user_id" UUID,
    "actor_kind" "ActorKind" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "text_version" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ran_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "results" JSONB NOT NULL,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "service_points_tenant_id_code_key" ON "service_points"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "service_points_tenant_id_prefix_key" ON "service_points"("tenant_id", "prefix");

-- CreateIndex
CREATE INDEX "slots_service_point_id_starts_at_idx" ON "slots"("service_point_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_access_token_key" ON "tickets"("access_token");

-- CreateIndex
CREATE INDEX "tickets_service_point_id_queue_date_status_seq_idx" ON "tickets"("service_point_id", "queue_date", "status", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_service_point_id_queue_date_seq_key" ON "tickets"("service_point_id", "queue_date", "seq");

-- CreateIndex
CREATE INDEX "queue_events_ticket_id_id_idx" ON "queue_events"("ticket_id", "id");

-- CreateIndex
CREATE INDEX "queue_events_service_point_id_id_idx" ON "queue_events"("service_point_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "consents_ticket_id_key" ON "consents"("ticket_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE INDEX "audit_runs_tenant_id_ran_at_idx" ON "audit_runs"("tenant_id", "ran_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "service_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_counters" ADD CONSTRAINT "ticket_counters_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "service_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "service_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_events" ADD CONSTRAINT "queue_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

