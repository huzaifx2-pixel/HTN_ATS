ALTER TABLE "JobMatch" ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "JobMatch_jobId_dismissedAt_idx" ON "JobMatch"("jobId", "dismissedAt");
