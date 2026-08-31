-- Marketing audience imported contacts
CREATE TABLE IF NOT EXISTS "MarketingAudienceContact" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingAudienceContact_audienceId_email_key"
    ON "MarketingAudienceContact"("audienceId", "email");
CREATE INDEX IF NOT EXISTS "MarketingAudienceContact_audienceId_idx"
    ON "MarketingAudienceContact"("audienceId");
CREATE INDEX IF NOT EXISTS "MarketingAudienceContact_organizationId_idx"
    ON "MarketingAudienceContact"("organizationId");

ALTER TABLE "MarketingAudienceContact"
    ADD CONSTRAINT "MarketingAudienceContact_audienceId_fkey"
    FOREIGN KEY ("audienceId") REFERENCES "MarketingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingAudienceContact"
    ADD CONSTRAINT "MarketingAudienceContact_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignRecipient"
    ADD COLUMN IF NOT EXISTS "importMeta" JSONB;
