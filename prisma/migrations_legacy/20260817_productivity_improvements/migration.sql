-- Job templates, saved views, campaign approval status
CREATE TYPE "SavedViewEntity" AS ENUM ('CANDIDATES', 'JOBS');

ALTER TYPE "MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

CREATE TABLE "JobTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "booleanSearch" TEXT,
    "requirements" JSONB,
    "employmentType" "EmploymentType",
    "workplaceType" "WorkplaceType",
    "department" TEXT,
    "seniority" TEXT,
    "experienceMin" INTEGER,
    "experienceMax" INTEGER,
    "location" TEXT,
    "country" TEXT,
    "city" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "SavedViewEntity" NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobTemplate_organizationId_idx" ON "JobTemplate"("organizationId");
CREATE INDEX "SavedView_organizationId_userId_entityType_idx" ON "SavedView"("organizationId", "userId", "entityType");

ALTER TABLE "JobTemplate" ADD CONSTRAINT "JobTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
