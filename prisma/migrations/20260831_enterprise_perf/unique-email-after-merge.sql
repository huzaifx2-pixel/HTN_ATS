-- Apply ONLY after `npx tsx scripts/merge-duplicate-emails.ts --apply`
-- succeeds and `SELECT ... HAVING COUNT(*) > 1` on normalizedEmail returns 0.

CREATE UNIQUE INDEX IF NOT EXISTS "Candidate_organizationId_normalizedEmail_unique"
  ON "Candidate"("organizationId", "normalizedEmail")
  WHERE "normalizedEmail" IS NOT NULL AND "deletedAt" IS NULL;
