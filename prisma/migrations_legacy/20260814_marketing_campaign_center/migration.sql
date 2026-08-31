-- Marketing Email Campaign Center

CREATE TYPE "MarketingCampaignType" AS ENUM ('JOB_BLAST', 'NEWSLETTER', 'HIRING_EVENT', 'EMPLOYER_BRANDING', 'REFERRAL', 'RE_ENGAGEMENT', 'CUSTOM');
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "MarketingScheduleType" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'RECURRING');
CREATE TYPE "MarketingRecurrence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');
CREATE TYPE "MarketingTemplateCategory" AS ENUM ('JOB_BLAST', 'NEWSLETTER', 'HIRING_EVENT', 'REFERRAL', 'REACTIVATION', 'EMPLOYER_BRANDING', 'SUCCESS_STORY', 'CUSTOM');
CREATE TYPE "MarketingRecipientStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'APPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'FAILED');
CREATE TYPE "MarketingAutomationTrigger" AS ENUM ('CANDIDATE_CREATED', 'APPLICATION_SUBMITTED', 'CANDIDATE_HIRED', 'CANDIDATE_REJECTED', 'NO_ACTIVITY', 'EVENT_REGISTRATION', 'MANUAL');
CREATE TYPE "MarketingEmailProvider" AS ENUM ('GMAIL', 'AWS_SES', 'SENDGRID', 'MAILGUN', 'POSTMARK', 'MICROSOFT_365');

CREATE TABLE "MarketingBrandKit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e3a5f',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0d9488',
    "fontFamily" TEXT NOT NULL DEFAULT 'Arial, Helvetica, sans-serif',
    "footerHtml" TEXT,
    "socialLinks" JSONB,
    "signatureHtml" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingBrandKit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingMediaAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'general',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingAudience" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "estimatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MarketingTemplateCategory" NOT NULL DEFAULT 'CUSTOM',
    "subject" TEXT NOT NULL,
    "designJson" JSONB NOT NULL,
    "htmlContent" TEXT,
    "thumbnailUrl" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalNotes" TEXT,
    "type" "MarketingCampaignType" NOT NULL DEFAULT 'CUSTOM',
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceId" TEXT,
    "templateId" TEXT,
    "subject" TEXT,
    "preheader" TEXT,
    "designJson" JSONB,
    "htmlContent" TEXT,
    "scheduleType" "MarketingScheduleType" NOT NULL DEFAULT 'IMMEDIATE',
    "scheduledAt" TIMESTAMP(3),
    "recurrence" "MarketingRecurrence",
    "sentAt" TIMESTAMP(3),
    "stats" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "candidateId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "MarketingRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "trackingId" TEXT NOT NULL,
    "personalizedHtml" TEXT,
    "personalizedJobs" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "MarketingAutomationTrigger" NOT NULL DEFAULT 'MANUAL',
    "workflowJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingAutomation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingSuppression" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingSuppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "emailProvider" "MarketingEmailProvider" NOT NULL DEFAULT 'GMAIL',
    "providerConfig" JSONB,
    "defaultFromName" TEXT,
    "defaultFromEmail" TEXT,
    "unsubscribeFooter" TEXT,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingBrandKit_organizationId_key" ON "MarketingBrandKit"("organizationId");
CREATE INDEX "MarketingMediaAsset_organizationId_folder_idx" ON "MarketingMediaAsset"("organizationId", "folder");
CREATE INDEX "MarketingAudience_organizationId_idx" ON "MarketingAudience"("organizationId");
CREATE INDEX "MarketingTemplate_organizationId_category_idx" ON "MarketingTemplate"("organizationId", "category");
CREATE INDEX "MarketingCampaign_organizationId_status_idx" ON "MarketingCampaign"("organizationId", "status");
CREATE INDEX "MarketingCampaign_organizationId_createdAt_idx" ON "MarketingCampaign"("organizationId", "createdAt");
CREATE INDEX "MarketingCampaignRecipient_campaignId_idx" ON "MarketingCampaignRecipient"("campaignId");
CREATE INDEX "MarketingCampaignRecipient_candidateId_idx" ON "MarketingCampaignRecipient"("candidateId");
CREATE INDEX "MarketingCampaignRecipient_email_idx" ON "MarketingCampaignRecipient"("email");
CREATE UNIQUE INDEX "MarketingCampaignRecipient_trackingId_key" ON "MarketingCampaignRecipient"("trackingId");
CREATE INDEX "MarketingAutomation_organizationId_isActive_idx" ON "MarketingAutomation"("organizationId", "isActive");
CREATE UNIQUE INDEX "MarketingSuppression_organizationId_email_key" ON "MarketingSuppression"("organizationId", "email");
CREATE INDEX "MarketingSuppression_organizationId_idx" ON "MarketingSuppression"("organizationId");
CREATE UNIQUE INDEX "MarketingSettings_organizationId_key" ON "MarketingSettings"("organizationId");

ALTER TABLE "MarketingBrandKit" ADD CONSTRAINT "MarketingBrandKit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingMediaAsset" ADD CONSTRAINT "MarketingMediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAudience" ADD CONSTRAINT "MarketingAudience_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTemplate" ADD CONSTRAINT "MarketingTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "MarketingAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSuppression" ADD CONSTRAINT "MarketingSuppression_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSettings" ADD CONSTRAINT "MarketingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
