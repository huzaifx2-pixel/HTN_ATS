-- Enterprise performance: FTS, pg_trgm, identity columns, match queue, search indexes.
-- Idempotent. Unique(org, normalizedEmail) is NOT applied here because 150 duplicate
-- email groups exist; run `npx tsx scripts/merge-duplicate-emails.ts` first.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "normalizedEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "normalizedPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "normalizedLinkedIn" TEXT,
  ADD COLUMN IF NOT EXISTS "resumeFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "Candidate_organizationId_normalizedEmail_idx"
  ON "Candidate"("organizationId", "normalizedEmail");
CREATE INDEX IF NOT EXISTS "Candidate_organizationId_normalizedPhone_idx"
  ON "Candidate"("organizationId", "normalizedPhone");
CREATE INDEX IF NOT EXISTS "Candidate_organizationId_normalizedLinkedIn_idx"
  ON "Candidate"("organizationId", "normalizedLinkedIn");
CREATE INDEX IF NOT EXISTS "Candidate_organizationId_resumeFingerprint_idx"
  ON "Candidate"("organizationId", "resumeFingerprint");

CREATE INDEX IF NOT EXISTS "Candidate_firstName_trgm_idx"
  ON "Candidate" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Candidate_lastName_trgm_idx"
  ON "Candidate" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Candidate_email_trgm_idx"
  ON "Candidate" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Candidate_location_trgm_idx"
  ON "Candidate" USING GIN ("location" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Candidate_currentCompany_trgm_idx"
  ON "Candidate" USING GIN ("currentCompany" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Candidate_currentTitle_trgm_idx"
  ON "Candidate" USING GIN ("currentTitle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Candidate_headline_trgm_idx"
  ON "Candidate" USING GIN ("headline" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Job_title_trgm_idx"
  ON "Job" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Job_location_trgm_idx"
  ON "Job" USING GIN ("location" gin_trgm_ops);

CREATE TABLE IF NOT EXISTS "MatchWorkItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "candidateId" TEXT,
  "jobId" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lastError" TEXT,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchWorkItem_status_runAfter_idx"
  ON "MatchWorkItem"("status", "runAfter");
CREATE INDEX IF NOT EXISTS "MatchWorkItem_organizationId_status_idx"
  ON "MatchWorkItem"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "MatchWorkItem_candidateId_status_idx"
  ON "MatchWorkItem"("candidateId", "status");
CREATE INDEX IF NOT EXISTS "MatchWorkItem_jobId_status_idx"
  ON "MatchWorkItem"("jobId", "status");

CREATE TABLE IF NOT EXISTS "CandidateSearchIndex" (
  "candidateId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "searchDocument" TEXT NOT NULL,
  "searchVector" tsvector,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateSearchIndex_pkey" PRIMARY KEY ("candidateId"),
  CONSTRAINT "CandidateSearchIndex_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CandidateSearchIndex_organizationId_idx"
  ON "CandidateSearchIndex"("organizationId");

ALTER TABLE "CandidateSearchIndex" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

CREATE TABLE IF NOT EXISTS "JobSearchIndex" (
  "jobId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "searchDocument" TEXT NOT NULL,
  "searchVector" tsvector,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobSearchIndex_pkey" PRIMARY KEY ("jobId"),
  CONSTRAINT "JobSearchIndex_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "JobSearchIndex_organizationId_idx"
  ON "JobSearchIndex"("organizationId");

ALTER TABLE "JobSearchIndex" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

CREATE OR REPLACE FUNCTION headsbase_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW."searchDocument", ''));
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS candidate_search_vector_trigger ON "CandidateSearchIndex";
CREATE TRIGGER candidate_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "searchDocument"
  ON "CandidateSearchIndex"
  FOR EACH ROW
  EXECUTE PROCEDURE headsbase_search_vector_update();

DROP TRIGGER IF EXISTS job_search_vector_trigger ON "JobSearchIndex";
CREATE TRIGGER job_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "searchDocument"
  ON "JobSearchIndex"
  FOR EACH ROW
  EXECUTE PROCEDURE headsbase_search_vector_update();

CREATE INDEX IF NOT EXISTS "CandidateSearchIndex_searchVector_gin"
  ON "CandidateSearchIndex" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "CandidateSearchIndex_searchDocument_trgm"
  ON "CandidateSearchIndex" USING GIN ("searchDocument" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "JobSearchIndex_searchVector_gin"
  ON "JobSearchIndex" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "JobSearchIndex_searchDocument_trgm"
  ON "JobSearchIndex" USING GIN ("searchDocument" gin_trgm_ops);

UPDATE "Candidate"
SET
  "normalizedEmail" = NULLIF(lower(trim(email)), ''),
  "normalizedPhone" = NULLIF(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), ''),
  "normalizedLinkedIn" = NULLIF(
    lower(regexp_replace(regexp_replace(coalesce("linkedIn", ''), '^https?://(www\.)?', '', 'i'), '/+$', '')),
    ''
  )
WHERE "deletedAt" IS NULL
  AND (
    "normalizedEmail" IS NULL
    OR "normalizedPhone" IS NULL
    OR "normalizedLinkedIn" IS NULL
  );

INSERT INTO "CandidateSearchIndex" ("candidateId", "organizationId", "searchDocument")
SELECT
  c.id,
  c."organizationId",
  left(concat_ws(
    ' ',
    c."firstName",
    c."lastName",
    c.email,
    c.headline,
    c.summary,
    c."currentRole",
    c."currentTitle",
    c."currentCompany",
    c.location,
    c.city,
    c.country,
    c."workAuthorization",
    c.skills::text,
    pr.summary,
    left(coalesce(pr."rawText", ''), 120000)
  ), 180000)
FROM "Candidate" c
LEFT JOIN "ParsedResume" pr ON pr."candidateId" = c.id
WHERE c."deletedAt" IS NULL
ON CONFLICT ("candidateId") DO UPDATE
SET "searchDocument" = EXCLUDED."searchDocument";

INSERT INTO "JobSearchIndex" ("jobId", "organizationId", "searchDocument")
SELECT
  j.id,
  j."organizationId",
  left(concat_ws(
    ' ',
    j.title,
    j."jobCode",
    j.location,
    j.city,
    j.country,
    j.department,
    j.seniority,
    j."booleanSearch",
    left(coalesce(j.description, ''), 20000)
  ), 60000)
FROM "Job" j
ON CONFLICT ("jobId") DO UPDATE
SET "searchDocument" = EXCLUDED."searchDocument";
