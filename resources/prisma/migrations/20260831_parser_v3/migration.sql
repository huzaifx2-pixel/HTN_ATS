ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "currentEmployerId" TEXT;

CREATE TABLE IF NOT EXISTS "Employer" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "website" TEXT,
  "linkedIn" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Employer_organizationId_normalizedName_key"
  ON "Employer"("organizationId", "normalizedName");
CREATE INDEX IF NOT EXISTS "Employer_organizationId_idx" ON "Employer"("organizationId");

CREATE TABLE IF NOT EXISTS "CandidateExperience" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "employerId" TEXT,
  "company" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "location" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "durationMonths" INTEGER,
  "confidence" DOUBLE PRECISION,
  "reviewStatus" TEXT,
  "extractionMethod" TEXT,
  "source" TEXT,
  "responsibilities" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CandidateExperience_candidateId_idx" ON "CandidateExperience"("candidateId");
CREATE INDEX IF NOT EXISTS "CandidateExperience_employerId_idx" ON "CandidateExperience"("employerId");

CREATE TABLE IF NOT EXISTS "CandidateEducation" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "degree" TEXT,
  "field" TEXT,
  "honors" TEXT,
  "graduationDate" TEXT,
  "confidence" DOUBLE PRECISION,
  "reviewStatus" TEXT,
  "extractionMethod" TEXT,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CandidateEducation_candidateId_idx" ON "CandidateEducation"("candidateId");

CREATE TABLE IF NOT EXISTS "CandidateCertification" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "issueDate" TEXT,
  "expiryDate" TEXT,
  "credentialId" TEXT,
  "status" TEXT,
  "confidence" DOUBLE PRECISION,
  "reviewStatus" TEXT,
  "extractionMethod" TEXT,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateCertification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CandidateCertification_candidateId_idx" ON "CandidateCertification"("candidateId");

DO $$ BEGIN
  ALTER TABLE "Employer" ADD CONSTRAINT "Employer_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_currentEmployerId_fkey"
    FOREIGN KEY ("currentEmployerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_employerId_fkey"
    FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateCertification" ADD CONSTRAINT "CandidateCertification_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Candidate_currentEmployerId_idx" ON "Candidate"("currentEmployerId");
