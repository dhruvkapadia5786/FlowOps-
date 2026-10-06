-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE 'expired';

-- AlterTable: add nullable first, backfill, then enforce NOT NULL
ALTER TABLE "approvals" ADD COLUMN "expires_at" TIMESTAMPTZ(6);

UPDATE "approvals"
SET "expires_at" = "created_at" + INTERVAL '24 hours'
WHERE "expires_at" IS NULL;

ALTER TABLE "approvals" ALTER COLUMN "expires_at" SET NOT NULL;

-- CreateIndex
CREATE INDEX "approvals_expires_at_idx" ON "approvals"("expires_at");
