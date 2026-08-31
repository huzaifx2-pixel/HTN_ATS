ALTER TYPE "CandidateSource" ADD VALUE 'LINKEDIN';

CREATE TABLE "LinkedInJobMatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "linkedInUrl" TEXT NOT NULL,
    "linkedInSlug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "currentTitle" TEXT,
    "currentCompany" TEXT,
    "location" TEXT,
    "photoUrl" TEXT,
    "snippet" TEXT,
    "education" TEXT,
    "certifications" JSONB,
    "skills" JSONB,
    "experienceYears" DOUBLE PRECISION,
    "matchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skillMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "experienceMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locationMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "educationMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchLabel" TEXT,
    "googleQuery" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),
    "importedCandidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInJobMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkedInJobMatch_jobId_linkedInUrl_key" ON "LinkedInJobMatch"("jobId", "linkedInUrl");
CREATE INDEX "LinkedInJobMatch_jobId_importedAt_matchScore_idx" ON "LinkedInJobMatch"("jobId", "importedAt", "matchScore");
CREATE INDEX "LinkedInJobMatch_organizationId_jobId_idx" ON "LinkedInJobMatch"("organizationId", "jobId");
CREATE INDEX "LinkedInJobMatch_importedCandidateId_idx" ON "LinkedInJobMatch"("importedCandidateId");

ALTER TABLE "LinkedInJobMatch" ADD CONSTRAINT "LinkedInJobMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedInJobMatch" ADD CONSTRAINT "LinkedInJobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedInJobMatch" ADD CONSTRAINT "LinkedInJobMatch_importedCandidateId_fkey" FOREIGN KEY ("importedCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
