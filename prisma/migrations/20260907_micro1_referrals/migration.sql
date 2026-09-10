-- CreateEnum
CREATE TYPE "Micro1ReferralStage" AS ENUM ('DUPLICATE', 'APPLYING', 'AI_INTERVIEW', 'CRITERIA_MET', 'CERTIFIED', 'MATCHED', 'STARTED', 'SUCCESSFUL');

-- CreateEnum
CREATE TYPE "Micro1MatchingStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'NEEDS_REVIEW', 'LEFT_UNMATCHED');

-- CreateEnum
CREATE TYPE "Micro1ImportBatchStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN "micro1ReferralStatusMap" JSONB;

-- CreateTable
CREATE TABLE "Micro1Referral" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateId" TEXT,
    "identityKey" TEXT NOT NULL,
    "csvName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "externalId" TEXT,
    "referrer" TEXT,
    "dateReferred" TIMESTAMP(3),
    "projectType" TEXT,
    "csvStatus" TEXT NOT NULL,
    "stage" "Micro1ReferralStage" NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "aiInterviewCompletedAt" TIMESTAMP(3),
    "criteriaMetAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    "matchedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "successfulAt" TIMESTAMP(3),
    "tasksCompleted" INTEGER,
    "hoursWorked" DECIMAL(12,2),
    "payoutAmount" DECIMAL(12,2),
    "transactionId" TEXT,
    "matchingStatus" "Micro1MatchingStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchingConfidence" DOUBLE PRECISION,
    "matchingReason" TEXT,
    "suggestedCandidateId" TEXT,
    "lastImportBatchId" TEXT,
    "lastImportedAt" TIMESTAMP(3),
    "lastSeenInImportAt" TIMESTAMP(3),
    "linkedByUserId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Micro1Referral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Micro1ReferralStatusEvent" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "csvStatus" TEXT NOT NULL,
    "mappedStage" "Micro1ReferralStage",
    "appliedStage" "Micro1ReferralStage" NOT NULL,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Micro1ReferralStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Micro1ReferralImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "Micro1ImportBatchStatus" NOT NULL DEFAULT 'RUNNING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "unmatched" INTEGER NOT NULL DEFAULT 0,
    "needsReview" INTEGER NOT NULL DEFAULT 0,
    "statusChanges" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Micro1ReferralImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Micro1NameLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Micro1NameLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Micro1MatchAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "fromStatus" "Micro1MatchingStatus" NOT NULL,
    "toStatus" "Micro1MatchingStatus" NOT NULL,
    "candidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Micro1MatchAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Micro1Referral_organizationId_identityKey_key" ON "Micro1Referral"("organizationId", "identityKey");
CREATE UNIQUE INDEX "Micro1Referral_organizationId_candidateId_key" ON "Micro1Referral"("organizationId", "candidateId") WHERE "candidateId" IS NOT NULL;
CREATE INDEX "Micro1Referral_organizationId_stage_idx" ON "Micro1Referral"("organizationId", "stage");
CREATE INDEX "Micro1Referral_organizationId_matchingStatus_idx" ON "Micro1Referral"("organizationId", "matchingStatus");
CREATE INDEX "Micro1Referral_organizationId_csvStatus_idx" ON "Micro1Referral"("organizationId", "csvStatus");
CREATE INDEX "Micro1Referral_organizationId_lastSeenInImportAt_idx" ON "Micro1Referral"("organizationId", "lastSeenInImportAt");
CREATE INDEX "Micro1Referral_candidateId_idx" ON "Micro1Referral"("candidateId");

CREATE INDEX "Micro1ReferralStatusEvent_referralId_createdAt_idx" ON "Micro1ReferralStatusEvent"("referralId", "createdAt");

CREATE INDEX "Micro1ReferralImportBatch_organizationId_createdAt_idx" ON "Micro1ReferralImportBatch"("organizationId", "createdAt");
CREATE INDEX "Micro1ReferralImportBatch_organizationId_fileHash_idx" ON "Micro1ReferralImportBatch"("organizationId", "fileHash");

CREATE UNIQUE INDEX "Micro1NameLink_organizationId_normalizedName_key" ON "Micro1NameLink"("organizationId", "normalizedName");
CREATE INDEX "Micro1NameLink_candidateId_idx" ON "Micro1NameLink"("candidateId");

CREATE INDEX "Micro1MatchAudit_referralId_createdAt_idx" ON "Micro1MatchAudit"("referralId", "createdAt");
CREATE INDEX "Micro1MatchAudit_organizationId_createdAt_idx" ON "Micro1MatchAudit"("organizationId", "createdAt");

ALTER TABLE "Micro1Referral" ADD CONSTRAINT "Micro1Referral_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Micro1Referral" ADD CONSTRAINT "Micro1Referral_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Micro1Referral" ADD CONSTRAINT "Micro1Referral_suggestedCandidateId_fkey" FOREIGN KEY ("suggestedCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Micro1Referral" ADD CONSTRAINT "Micro1Referral_lastImportBatchId_fkey" FOREIGN KEY ("lastImportBatchId") REFERENCES "Micro1ReferralImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Micro1Referral" ADD CONSTRAINT "Micro1Referral_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Micro1ReferralStatusEvent" ADD CONSTRAINT "Micro1ReferralStatusEvent_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Micro1Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Micro1ReferralStatusEvent" ADD CONSTRAINT "Micro1ReferralStatusEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "Micro1ReferralImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Micro1ReferralImportBatch" ADD CONSTRAINT "Micro1ReferralImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Micro1ReferralImportBatch" ADD CONSTRAINT "Micro1ReferralImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Micro1NameLink" ADD CONSTRAINT "Micro1NameLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Micro1NameLink" ADD CONSTRAINT "Micro1NameLink_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Micro1MatchAudit" ADD CONSTRAINT "Micro1MatchAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Micro1MatchAudit" ADD CONSTRAINT "Micro1MatchAudit_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Micro1Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Micro1MatchAudit" ADD CONSTRAINT "Micro1MatchAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
