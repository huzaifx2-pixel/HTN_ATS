-- Matching v2: persist qualification status, confidence, and requirement breakdowns.
-- Idempotent.

ALTER TABLE "JobMatch"
  ADD COLUMN IF NOT EXISTS "matchStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "confidence" TEXT,
  ADD COLUMN IF NOT EXISTS "requirementBreakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "retrievalScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "JobMatch" DROP CONSTRAINT IF EXISTS "JobMatch_matchStatus_check";
ALTER TABLE "JobMatch"
  ADD CONSTRAINT "JobMatch_matchStatus_check"
  CHECK ("matchStatus" IS NULL OR "matchStatus" IN ('EXCELLENT', 'STRONG', 'POTENTIAL'));

ALTER TABLE "JobMatch" DROP CONSTRAINT IF EXISTS "JobMatch_confidence_check";
ALTER TABLE "JobMatch"
  ADD CONSTRAINT "JobMatch_confidence_check"
  CHECK ("confidence" IS NULL OR "confidence" IN ('High', 'Medium', 'Low'));

CREATE INDEX IF NOT EXISTS "JobMatch_jobId_matchStatus_idx"
  ON "JobMatch"("jobId", "matchStatus");
