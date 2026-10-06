-- M13: composite indexes for common filtered list queries
CREATE INDEX IF NOT EXISTS "deployments_organization_id_status_created_at_idx"
  ON "deployments"("organization_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "approvals_status_expires_at_idx"
  ON "approvals"("status", "expires_at");
