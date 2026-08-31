-- ResumeImportBatch + EmailSendQueue

CREATE TYPE "ResumeImportStatus" AS ENUM ('SUCCESS', 'FAILED', 'DUPLICATE', 'SKIPPED');
CREATE TYPE "EmailQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "ResumeImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT,
    "source" "CandidateSource" NOT NULL,
    "status" "ResumeImportStatus" NOT NULL,
    "parseError" TEXT,
    "durationMs" INTEGER,
    "duplicateOfId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumeImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSendQueue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "autoSent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailSendQueue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ResumeImportBatch" ADD CONSTRAINT "ResumeImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeImportBatch" ADD CONSTRAINT "ResumeImportBatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ResumeImportBatch_organizationId_createdAt_idx" ON "ResumeImportBatch"("organizationId", "createdAt");
CREATE INDEX "ResumeImportBatch_candidateId_idx" ON "ResumeImportBatch"("candidateId");
CREATE INDEX "ResumeImportBatch_fileHash_idx" ON "ResumeImportBatch"("fileHash");
CREATE INDEX "EmailSendQueue_status_nextRetryAt_idx" ON "EmailSendQueue"("status", "nextRetryAt");
CREATE INDEX "EmailSendQueue_organizationId_idx" ON "EmailSendQueue"("organizationId");
CREATE INDEX "EmailSendQueue_jobId_candidateId_idx" ON "EmailSendQueue"("jobId", "candidateId");
