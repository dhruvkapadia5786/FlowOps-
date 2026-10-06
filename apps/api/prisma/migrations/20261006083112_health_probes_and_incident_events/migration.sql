-- CreateEnum
CREATE TYPE "HealthProbeType" AS ENUM ('api', 'db', 'redis', 'queue', 'external');

-- CreateEnum
CREATE TYPE "HealthProbeStatus" AS ENUM ('healthy', 'degraded', 'unhealthy');

-- AlterTable
ALTER TABLE "health_check_configs" ADD COLUMN     "latency_threshold_ms" INTEGER NOT NULL DEFAULT 500,
ALTER COLUMN "failure_threshold" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "service_health_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "overall_status" "HealthProbeStatus" NOT NULL,
    "uptime_percent" DOUBLE PRECISION NOT NULL,
    "avg_latency_ms" INTEGER NOT NULL,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_probe_results" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "probe_type" "HealthProbeType" NOT NULL,
    "status" "HealthProbeStatus" NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "message" TEXT,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_probe_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_events" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "from_status" "IncidentStatus",
    "to_status" "IncidentStatus" NOT NULL,
    "message" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_health_snapshots_organization_id_overall_status_idx" ON "service_health_snapshots"("organization_id", "overall_status");

-- CreateIndex
CREATE UNIQUE INDEX "service_health_snapshots_service_id_environment_id_key" ON "service_health_snapshots"("service_id", "environment_id");

-- CreateIndex
CREATE INDEX "health_probe_results_snapshot_id_probe_type_idx" ON "health_probe_results"("snapshot_id", "probe_type");

-- CreateIndex
CREATE INDEX "incident_events_incident_id_created_at_idx" ON "incident_events"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incidents_organization_id_source_idx" ON "incidents"("organization_id", "source");

-- AddForeignKey
ALTER TABLE "service_health_snapshots" ADD CONSTRAINT "service_health_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_health_snapshots" ADD CONSTRAINT "service_health_snapshots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_health_snapshots" ADD CONSTRAINT "service_health_snapshots_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_probe_results" ADD CONSTRAINT "health_probe_results_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "service_health_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
