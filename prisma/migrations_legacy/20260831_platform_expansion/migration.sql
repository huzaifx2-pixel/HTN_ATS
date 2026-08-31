-- Member roles expansion
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'MARKETING';
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'FINANCE';

-- Saved view entity expansion
ALTER TYPE "SavedViewEntity" ADD VALUE IF NOT EXISTS 'TALENT_SEARCH';

-- Opportunity pipeline
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

CREATE TABLE IF NOT EXISTS "CandidateHotlist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateHotlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CandidateHotlistMember" (
    "hotlistId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateHotlistMember_pkey" PRIMARY KEY ("hotlistId","candidateId")
);

CREATE TABLE IF NOT EXISTS "CrmContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "department" TEXT,
    "linkedIn" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Opportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'LEAD',
    "value" DECIMAL(65,30),
    "currency" TEXT DEFAULT 'USD',
    "expectedClose" TIMESTAMP(3),
    "ownerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CandidateHotlist_organizationId_idx" ON "CandidateHotlist"("organizationId");
CREATE INDEX IF NOT EXISTS "CandidateHotlistMember_candidateId_idx" ON "CandidateHotlistMember"("candidateId");
CREATE INDEX IF NOT EXISTS "CrmContact_organizationId_idx" ON "CrmContact"("organizationId");
CREATE INDEX IF NOT EXISTS "CrmContact_clientId_idx" ON "CrmContact"("clientId");
CREATE INDEX IF NOT EXISTS "CrmContact_organizationId_email_idx" ON "CrmContact"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "Opportunity_organizationId_stage_idx" ON "Opportunity"("organizationId", "stage");
CREATE INDEX IF NOT EXISTS "Opportunity_clientId_idx" ON "Opportunity"("clientId");

ALTER TABLE "CandidateHotlist" ADD CONSTRAINT "CandidateHotlist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateHotlistMember" ADD CONSTRAINT "CandidateHotlistMember_hotlistId_fkey" FOREIGN KEY ("hotlistId") REFERENCES "CandidateHotlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateHotlistMember" ADD CONSTRAINT "CandidateHotlistMember_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
