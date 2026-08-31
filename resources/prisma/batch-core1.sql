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
    "postedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
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
