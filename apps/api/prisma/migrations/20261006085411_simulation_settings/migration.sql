-- CreateTable
CREATE TABLE "simulation_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "simulation_mode" BOOLEAN NOT NULL DEFAULT true,
    "build_fail_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deploy_fail_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "health_fail_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stage_delay_ms" INTEGER NOT NULL DEFAULT 400,
    "deterministic" BOOLEAN NOT NULL DEFAULT false,
    "active_effects" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulation_settings_organization_id_key" ON "simulation_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "simulation_settings" ADD CONSTRAINT "simulation_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
