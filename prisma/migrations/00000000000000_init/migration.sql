-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER', 'MARKETING', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('COMPANY', 'CLIENT', 'VENDOR', 'MSP', 'UNIVERSITY', 'HOSPITAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('ON_SITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MICRO1', 'GREENHOUSE', 'LEVER', 'ASHBY', 'WORKDAY', 'LINKEDIN', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'ACTIVE', 'INTERVIEWING', 'PLACED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('CAREERS_SITE', 'RECRUITER', 'REFERRAL', 'IMPORT', 'LINKEDIN', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RESUME', 'COVER_LETTER', 'CERTIFICATION', 'PORTFOLIO', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "ResumeImportStatus" AS ENUM ('SUCCESS', 'FAILED', 'DUPLICATE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EmailQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('MANUAL', 'UPLOAD', 'BULK_UPLOAD', 'GMAIL', 'IMPORT', 'REFERRAL', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NOT_APPLIED', 'APPLYING', 'INTERVIEW_COMPLETED', 'MCC', 'CERTIFIED', 'MATCHED_TO_PROJECT', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('DM', 'GROUP', 'JOB');

-- CreateEnum
CREATE TYPE "MarketingCampaignType" AS ENUM ('JOB_BLAST', 'NEWSLETTER', 'HIRING_EVENT', 'EMPLOYER_BRANDING', 'REFERRAL', 'RE_ENGAGEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketingScheduleType" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'RECURRING');

-- CreateEnum
CREATE TYPE "MarketingRecurrence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "MarketingTemplateCategory" AS ENUM ('JOB_BLAST', 'NEWSLETTER', 'HIRING_EVENT', 'REFERRAL', 'REACTIVATION', 'EMPLOYER_BRANDING', 'SUCCESS_STORY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketingRecipientStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'APPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketingAutomationTrigger" AS ENUM ('CANDIDATE_CREATED', 'APPLICATION_SUBMITTED', 'CANDIDATE_HIRED', 'CANDIDATE_REJECTED', 'NO_ACTIVITY', 'EVENT_REGISTRATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "MarketingEmailProvider" AS ENUM ('GMAIL', 'AWS_SES', 'SENDGRID', 'MAILGUN', 'POSTMARK', 'MICROSOFT_365');

-- CreateEnum
CREATE TYPE "SavedViewEntity" AS ENUM ('CANDIDATES', 'JOBS', 'TALENT_SEARCH');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'RECRUITER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'RECRUITER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "logoUrl" TEXT,
    "externalId" TEXT,
    "sourceVersion" TEXT,
    "type" "OrganizationType",
    "legalName" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "headquarters" TEXT,
    "employeeCount" INTEGER,
    "foundedYear" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPrefixRule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientPrefixRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT,
    "jobCode" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceVersion" TEXT,
    "source" "JobSource",
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "descriptionHtml" TEXT,
    "responsibilities" TEXT,
    "requirementsText" TEXT,
    "preferredQualifications" TEXT,
    "benefits" TEXT,
    "employmentType" "EmploymentType",
    "workplaceType" "WorkplaceType",
    "department" TEXT,
    "seniority" TEXT,
    "experienceMin" INTEGER,
    "experienceMax" INTEGER,
    "salaryMin" DECIMAL(65,30),
    "salaryMax" DECIMAL(65,30),
    "salaryCurrency" TEXT,
    "location" TEXT,
    "country" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "remote" BOOLEAN,
    "referralLink" TEXT,
    "applyUrl" TEXT,
    "canonicalUrl" TEXT,
    "requirements" JSONB,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeHash" TEXT,
    "importedAt" TIMESTAMP(3),
    "autoEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoEmailTemplateId" TEXT,
    "autoEmailMinScore" INTEGER NOT NULL DEFAULT 70,
    "postedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "structured" JSONB,
    "parseMetadata" JSONB,
    "parserVersion" TEXT,
    "booleanSearch" TEXT,
    "booleanSearchUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSendQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobActivity" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceVersion" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NEW',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "headline" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneCountryCode" TEXT,
    "linkedIn" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "website" TEXT,
    "currentCompany" TEXT,
    "currentRole" TEXT,
    "currentTitle" TEXT,
    "location" TEXT,
    "country" TEXT,
    "city" TEXT,
    "skills" JSONB,
    "experienceYears" DOUBLE PRECISION,
    "yearsExperience" INTEGER,
    "workAuthorization" TEXT,
    "availability" TEXT,
    "desiredSalary" DECIMAL(65,30),
    "noticePeriod" INTEGER,
    "summary" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'MANUAL',
    "currentClientId" TEXT,
    "dedupeHash" TEXT,
    "engagedAt" TIMESTAMP(3),
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "doNotContactAt" TIMESTAMP(3),
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "gmailAttachmentId" TEXT,
    "fileName" TEXT,
    "candidateId" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "parsedData" JSONB,
    "suggestedJobs" JSONB,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedResume" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "rawText" TEXT,
    "skills" JSONB,
    "experience" JSONB,
    "education" JSONB,
    "certifications" JSONB,
    "structured" JSONB,
    "parseMetadata" JSONB,
    "parserVersion" TEXT,
    "summary" TEXT,
    "projects" JSONB,
    "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParsedResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateActivity" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "jobId" TEXT,
    "candidateId" TEXT,
    "clientId" TEXT,
    "type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "storageProvider" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT,
    "metadata" JSONB,
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceVersion" TEXT,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL DEFAULT 'NOT_APPLIED',
    "source" "ApplicationSource",
    "coverLetter" TEXT,
    "additionalNotes" TEXT,
    "salaryExpectation" DECIMAL(65,30),
    "noticePeriod" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStage" "PipelineStage",
    "toStage" "PipelineStage" NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skillsMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "experienceMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descriptionMatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missingSkills" JSONB,
    "reason" TEXT,
    "analysis" JSONB,
    "semanticScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceVersion" TEXT,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceVersion" TEXT,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCategoryAssignment" (
    "skillId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillCategoryAssignment_pkey" PRIMARY KEY ("skillId","categoryId")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "candidateId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "yearsExperience" INTEGER,
    "proficiency" TEXT,
    "verified" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("candidateId","skillId")
);

-- CreateTable
CREATE TABLE "JobSkill" (
    "jobId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "required" BOOLEAN,
    "priority" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSkill_pkey" PRIMARY KEY ("jobId","skillId")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "candidateId" TEXT,
    "jobId" TEXT,
    "templateId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "autoSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT,
    "type" "ChannelType" NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" JSONB,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "historyId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "MarketingAudienceContact" (
    "id" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "department" TEXT,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAudienceContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "candidateId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "importMeta" JSONB,
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "MarketingSuppression" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchingWeights" JSONB,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "storageLimitBytes" BIGINT NOT NULL DEFAULT 214748364800,
    "featureFlags" JSONB,
    "websiteJobLastSyncAt" TIMESTAMP(3),
    "websiteJobLastSyncStats" JSONB,
    "websiteJobAutoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'org',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateHotlist" (
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

-- CreateTable
CREATE TABLE "CandidateHotlistMember" (
    "hotlistId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateHotlistMember_pkey" PRIMARY KEY ("hotlistId","candidateId")
);

-- CreateTable
CREATE TABLE "CrmContact" (
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

-- CreateTable
CREATE TABLE "Opportunity" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Member_organizationId_idx" ON "Member"("organizationId");

-- CreateIndex
CREATE INDEX "Member_userId_idx" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_organizationId_userId_key" ON "Member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE INDEX "Client_externalId_idx" ON "Client"("externalId");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_prefix_key" ON "Client"("organizationId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPrefixRule_clientId_key" ON "ClientPrefixRule"("clientId");

-- CreateIndex
CREATE INDEX "Job_organizationId_status_idx" ON "Job"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Job_organizationId_status_createdAt_idx" ON "Job"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_organizationId_status_importedAt_idx" ON "Job"("organizationId", "status", "importedAt");

-- CreateIndex
CREATE INDEX "Job_organizationId_status_closedAt_idx" ON "Job"("organizationId", "status", "closedAt");

-- CreateIndex
CREATE INDEX "Job_organizationId_source_idx" ON "Job"("organizationId", "source");

-- CreateIndex
CREATE INDEX "Job_externalId_idx" ON "Job"("externalId");

-- CreateIndex
CREATE INDEX "Job_clientId_idx" ON "Job"("clientId");

-- CreateIndex
CREATE INDEX "Job_dedupeHash_idx" ON "Job"("dedupeHash");

-- CreateIndex
CREATE INDEX "Job_employmentType_idx" ON "Job"("employmentType");

-- CreateIndex
CREATE INDEX "Job_workplaceType_idx" ON "Job"("workplaceType");

-- CreateIndex
CREATE INDEX "Job_postedAt_idx" ON "Job"("postedAt");

-- CreateIndex
CREATE INDEX "Job_organizationId_updatedAt_idx" ON "Job"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Job_organizationId_title_idx" ON "Job"("organizationId", "title");

-- CreateIndex
CREATE INDEX "Job_organizationId_location_idx" ON "Job"("organizationId", "location");

-- CreateIndex
CREATE UNIQUE INDEX "Job_organizationId_jobCode_key" ON "Job"("organizationId", "jobCode");

-- CreateIndex
CREATE UNIQUE INDEX "Job_organizationId_source_externalId_key" ON "Job"("organizationId", "source", "externalId");

-- CreateIndex
CREATE INDEX "ResumeImportBatch_organizationId_createdAt_idx" ON "ResumeImportBatch"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeImportBatch_candidateId_idx" ON "ResumeImportBatch"("candidateId");

-- CreateIndex
CREATE INDEX "ResumeImportBatch_fileHash_idx" ON "ResumeImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "EmailSendQueue_status_nextRetryAt_idx" ON "EmailSendQueue"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "EmailSendQueue_organizationId_idx" ON "EmailSendQueue"("organizationId");

-- CreateIndex
CREATE INDEX "EmailSendQueue_jobId_candidateId_idx" ON "EmailSendQueue"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "JobActivity_jobId_createdAt_idx" ON "JobActivity"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_idx" ON "Candidate"("organizationId");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_createdAt_idx" ON "Candidate"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_deletedAt_createdAt_idx" ON "Candidate"("organizationId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_email_idx" ON "Candidate"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_engagedAt_idx" ON "Candidate"("organizationId", "engagedAt");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_status_idx" ON "Candidate"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_firstName_idx" ON "Candidate"("organizationId", "firstName");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_lastName_idx" ON "Candidate"("organizationId", "lastName");

-- CreateIndex
CREATE INDEX "Candidate_organizationId_location_idx" ON "Candidate"("organizationId", "location");

-- CreateIndex
CREATE INDEX "Candidate_currentClientId_idx" ON "Candidate"("currentClientId");

-- CreateIndex
CREATE INDEX "Candidate_externalId_idx" ON "Candidate"("externalId");

-- CreateIndex
CREATE INDEX "Candidate_dedupeHash_idx" ON "Candidate"("dedupeHash");

-- CreateIndex
CREATE INDEX "Candidate_deletedAt_idx" ON "Candidate"("deletedAt");

-- CreateIndex
CREATE INDEX "Candidate_linkedIn_idx" ON "Candidate"("linkedIn");

-- CreateIndex
CREATE INDEX "Candidate_updatedAt_idx" ON "Candidate"("updatedAt");

-- CreateIndex
CREATE INDEX "CandidateDraft_organizationId_status_idx" ON "CandidateDraft"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CandidateDraft_organizationId_status_createdAt_idx" ON "CandidateDraft"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateDraft_organizationId_gmailMessageId_idx" ON "CandidateDraft"("organizationId", "gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateDraft_organizationId_gmailMessageId_gmailAttachmen_key" ON "CandidateDraft"("organizationId", "gmailMessageId", "gmailAttachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedResume_candidateId_key" ON "ParsedResume"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateActivity_candidateId_createdAt_idx" ON "CandidateActivity"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_jobId_idx" ON "Document"("jobId");

-- CreateIndex
CREATE INDEX "Document_candidateId_idx" ON "Document"("candidateId");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Application_jobId_stage_idx" ON "Application"("jobId", "stage");

-- CreateIndex
CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

-- CreateIndex
CREATE INDEX "Application_updatedAt_idx" ON "Application"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_candidateId_key" ON "Application"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "StageHistory_applicationId_changedAt_idx" ON "StageHistory"("applicationId", "changedAt");

-- CreateIndex
CREATE INDEX "LinkedInJobMatch_jobId_importedAt_matchScore_idx" ON "LinkedInJobMatch"("jobId", "importedAt", "matchScore");

-- CreateIndex
CREATE INDEX "LinkedInJobMatch_organizationId_jobId_idx" ON "LinkedInJobMatch"("organizationId", "jobId");

-- CreateIndex
CREATE INDEX "LinkedInJobMatch_importedCandidateId_idx" ON "LinkedInJobMatch"("importedCandidateId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInJobMatch_jobId_linkedInUrl_key" ON "LinkedInJobMatch"("jobId", "linkedInUrl");

-- CreateIndex
CREATE INDEX "JobMatch_jobId_score_idx" ON "JobMatch"("jobId", "score" DESC);

-- CreateIndex
CREATE INDEX "JobMatch_candidateId_idx" ON "JobMatch"("candidateId");

-- CreateIndex
CREATE INDEX "JobMatch_jobId_computedAt_idx" ON "JobMatch"("jobId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_jobId_candidateId_key" ON "JobMatch"("jobId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCategory_name_key" ON "SkillCategory"("name");

-- CreateIndex
CREATE INDEX "SkillCategoryAssignment_categoryId_idx" ON "SkillCategoryAssignment"("categoryId");

-- CreateIndex
CREATE INDEX "CandidateSkill_skillId_idx" ON "CandidateSkill"("skillId");

-- CreateIndex
CREATE INDEX "JobSkill_skillId_idx" ON "JobSkill"("skillId");

-- CreateIndex
CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ReferralTemplate_organizationId_idx" ON "ReferralTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "EmailCampaign_jobId_idx" ON "EmailCampaign"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_trackingId_key" ON "EmailMessage"("trackingId");

-- CreateIndex
CREATE INDEX "EmailMessage_campaignId_idx" ON "EmailMessage"("campaignId");

-- CreateIndex
CREATE INDEX "EmailMessage_candidateId_idx" ON "EmailMessage"("candidateId");

-- CreateIndex
CREATE INDEX "EmailMessage_jobId_idx" ON "EmailMessage"("jobId");

-- CreateIndex
CREATE INDEX "EmailMessage_sentAt_idx" ON "EmailMessage"("sentAt");

-- CreateIndex
CREATE INDEX "Channel_organizationId_idx" ON "Channel"("organizationId");

-- CreateIndex
CREATE INDEX "Channel_jobId_idx" ON "Channel"("jobId");

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_userId_key" ON "GmailConnection"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingBrandKit_organizationId_key" ON "MarketingBrandKit"("organizationId");

-- CreateIndex
CREATE INDEX "MarketingMediaAsset_organizationId_folder_idx" ON "MarketingMediaAsset"("organizationId", "folder");

-- CreateIndex
CREATE INDEX "MarketingAudience_organizationId_idx" ON "MarketingAudience"("organizationId");

-- CreateIndex
CREATE INDEX "MarketingAudienceContact_audienceId_idx" ON "MarketingAudienceContact"("audienceId");

-- CreateIndex
CREATE INDEX "MarketingAudienceContact_organizationId_idx" ON "MarketingAudienceContact"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAudienceContact_audienceId_email_key" ON "MarketingAudienceContact"("audienceId", "email");

-- CreateIndex
CREATE INDEX "MarketingTemplate_organizationId_category_idx" ON "MarketingTemplate"("organizationId", "category");

-- CreateIndex
CREATE INDEX "MarketingCampaign_organizationId_status_idx" ON "MarketingCampaign"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MarketingCampaign_organizationId_createdAt_idx" ON "MarketingCampaign"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaignRecipient_trackingId_key" ON "MarketingCampaignRecipient"("trackingId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_campaignId_idx" ON "MarketingCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_candidateId_idx" ON "MarketingCampaignRecipient"("candidateId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_email_idx" ON "MarketingCampaignRecipient"("email");

-- CreateIndex
CREATE INDEX "MarketingAutomation_organizationId_isActive_idx" ON "MarketingAutomation"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "MarketingSuppression_organizationId_idx" ON "MarketingSuppression"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSuppression_organizationId_email_key" ON "MarketingSuppression"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSettings_organizationId_key" ON "MarketingSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_organizationId_key" ON "OrgSettings"("organizationId");

-- CreateIndex
CREATE INDEX "JobTemplate_organizationId_idx" ON "JobTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "SavedView_organizationId_userId_entityType_idx" ON "SavedView"("organizationId", "userId", "entityType");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_organizationId_idx" ON "KnowledgeDocument"("organizationId");

-- CreateIndex
CREATE INDEX "CandidateHotlist_organizationId_idx" ON "CandidateHotlist"("organizationId");

-- CreateIndex
CREATE INDEX "CandidateHotlistMember_candidateId_idx" ON "CandidateHotlistMember"("candidateId");

-- CreateIndex
CREATE INDEX "CrmContact_organizationId_idx" ON "CrmContact"("organizationId");

-- CreateIndex
CREATE INDEX "CrmContact_clientId_idx" ON "CrmContact"("clientId");

-- CreateIndex
CREATE INDEX "CrmContact_organizationId_email_idx" ON "CrmContact"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_stage_idx" ON "Opportunity"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "Opportunity_clientId_idx" ON "Opportunity"("clientId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPrefixRule" ADD CONSTRAINT "ClientPrefixRule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobImportBatch" ADD CONSTRAINT "JobImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportBatch" ADD CONSTRAINT "ResumeImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportBatch" ADD CONSTRAINT "ResumeImportBatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSendQueue" ADD CONSTRAINT "EmailSendQueue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActivity" ADD CONSTRAINT "JobActivity_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_currentClientId_fkey" FOREIGN KEY ("currentClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDraft" ADD CONSTRAINT "CandidateDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDraft" ADD CONSTRAINT "CandidateDraft_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedResume" ADD CONSTRAINT "ParsedResume_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateActivity" ADD CONSTRAINT "CandidateActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageHistory" ADD CONSTRAINT "StageHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageHistory" ADD CONSTRAINT "StageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInJobMatch" ADD CONSTRAINT "LinkedInJobMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInJobMatch" ADD CONSTRAINT "LinkedInJobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInJobMatch" ADD CONSTRAINT "LinkedInJobMatch_importedCandidateId_fkey" FOREIGN KEY ("importedCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCategoryAssignment" ADD CONSTRAINT "SkillCategoryAssignment_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCategoryAssignment" ADD CONSTRAINT "SkillCategoryAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SkillCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSkill" ADD CONSTRAINT "JobSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralTemplate" ADD CONSTRAINT "ReferralTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingBrandKit" ADD CONSTRAINT "MarketingBrandKit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMediaAsset" ADD CONSTRAINT "MarketingMediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudience" ADD CONSTRAINT "MarketingAudience_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudienceContact" ADD CONSTRAINT "MarketingAudienceContact_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "MarketingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudienceContact" ADD CONSTRAINT "MarketingAudienceContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTemplate" ADD CONSTRAINT "MarketingTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "MarketingAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSuppression" ADD CONSTRAINT "MarketingSuppression_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSettings" ADD CONSTRAINT "MarketingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTemplate" ADD CONSTRAINT "JobTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateHotlist" ADD CONSTRAINT "CandidateHotlist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateHotlistMember" ADD CONSTRAINT "CandidateHotlistMember_hotlistId_fkey" FOREIGN KEY ("hotlistId") REFERENCES "CandidateHotlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateHotlistMember" ADD CONSTRAINT "CandidateHotlistMember_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
