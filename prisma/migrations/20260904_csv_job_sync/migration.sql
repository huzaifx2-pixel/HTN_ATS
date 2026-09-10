-- CSV job sync: referralKey identity, CSV source, import batch preview lifecycle

CREATE TYPE "JobImportBatchStatus" AS ENUM ('PREVIEW', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TYPE "JobSource" ADD VALUE IF NOT EXISTS 'CSV';

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "referralKey" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "csvManagedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "lastCsvImportBatchId" TEXT;

ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "status" "JobImportBatchStatus" NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "newCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "updated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "reopened" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "willClose" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "closed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "unchanged" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "conflict" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "invalid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "duplicateRows" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "created" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "previewJson" JSONB;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "resultJson" JSONB;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "uploadedById" TEXT;
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "JobImportBatch" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

-- Backfill referralKey from trimmed referralLink
UPDATE "Job"
SET "referralKey" = NULLIF(BTRIM("referralLink"), '')
WHERE "referralLink" IS NOT NULL
  AND ("referralKey" IS NULL OR "referralKey" = '');

-- Clear duplicate referralKeys (keep oldest by createdAt, then id). Do not delete jobs.
WITH ranked AS (
  SELECT
    id,
    "organizationId",
    "referralKey",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "referralKey"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Job"
  WHERE "referralKey" IS NOT NULL
)
UPDATE "Job" j
SET "referralKey" = NULL
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Job_organizationId_referralKey_key"
  ON "Job"("organizationId", "referralKey");

CREATE INDEX IF NOT EXISTS "Job_organizationId_source_status_idx"
  ON "Job"("organizationId", "source", "status");

CREATE INDEX IF NOT EXISTS "Job_lastCsvImportBatchId_idx"
  ON "Job"("lastCsvImportBatchId");

CREATE INDEX IF NOT EXISTS "JobImportBatch_organizationId_createdAt_idx"
  ON "JobImportBatch"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "JobImportBatch_organizationId_status_idx"
  ON "JobImportBatch"("organizationId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Job_lastCsvImportBatchId_fkey'
  ) THEN
    ALTER TABLE "Job"
      ADD CONSTRAINT "Job_lastCsvImportBatchId_fkey"
      FOREIGN KEY ("lastCsvImportBatchId") REFERENCES "JobImportBatch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
