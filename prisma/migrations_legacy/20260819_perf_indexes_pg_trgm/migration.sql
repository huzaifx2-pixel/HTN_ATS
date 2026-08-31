-- Hot-path indexes + trigram search support for candidate/job lists.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Candidate_organizationId_createdAt_idx"
  ON "Candidate" ("organizationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Candidate_organizationId_deletedAt_createdAt_idx"
  ON "Candidate" ("organizationId", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Candidate_organizationId_firstName_idx"
  ON "Candidate" ("organizationId", "firstName");

CREATE INDEX IF NOT EXISTS "Candidate_organizationId_lastName_idx"
  ON "Candidate" ("organizationId", "lastName");

CREATE INDEX IF NOT EXISTS "Candidate_organizationId_location_idx"
  ON "Candidate" ("organizationId", "location");

CREATE INDEX IF NOT EXISTS "Candidate_linkedIn_idx"
  ON "Candidate" ("linkedIn");

CREATE INDEX IF NOT EXISTS "Candidate_updatedAt_idx"
  ON "Candidate" ("updatedAt");

CREATE INDEX IF NOT EXISTS "Job_organizationId_updatedAt_idx"
  ON "Job" ("organizationId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Job_organizationId_title_idx"
  ON "Job" ("organizationId", "title");

CREATE INDEX IF NOT EXISTS "Job_organizationId_location_idx"
  ON "Job" ("organizationId", "location");

CREATE INDEX IF NOT EXISTS "Application_updatedAt_idx"
  ON "Application" ("updatedAt");

CREATE INDEX IF NOT EXISTS "JobMatch_jobId_computedAt_idx"
  ON "JobMatch" ("jobId", "computedAt");

CREATE INDEX IF NOT EXISTS "ChannelMember_userId_idx"
  ON "ChannelMember" ("userId");

CREATE INDEX IF NOT EXISTS "CandidateDraft_organizationId_status_createdAt_idx"
  ON "CandidateDraft" ("organizationId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Candidate_name_trgm_idx"
  ON "Candidate" USING gin (("firstName" || ' ' || "lastName") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Candidate_email_trgm_idx"
  ON "Candidate" USING gin ("email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Candidate_location_trgm_idx"
  ON "Candidate" USING gin ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Job_title_trgm_idx"
  ON "Job" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Job_jobCode_trgm_idx"
  ON "Job" USING gin ("jobCode" gin_trgm_ops);
