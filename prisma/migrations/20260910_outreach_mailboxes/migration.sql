ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "matchOutreachDelayMs" INTEGER NOT NULL DEFAULT 45000;

ALTER TABLE "EmailSendQueue" ALTER COLUMN "templateId" DROP NOT NULL;
ALTER TABLE "EmailSendQueue" ALTER COLUMN "senderUserId" DROP NOT NULL;
ALTER TABLE "EmailSendQueue" ADD COLUMN IF NOT EXISTS "outreachMailboxId" TEXT;
ALTER TABLE "EmailSendQueue" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "EmailSendQueue" ADD COLUMN IF NOT EXISTS "body" TEXT;
ALTER TABLE "EmailSendQueue" ADD COLUMN IF NOT EXISTS "customLink" TEXT;

CREATE TABLE IF NOT EXISTS "OutreachMailbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 2000,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "sentCountDate" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachMailbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OutreachMailbox_organizationId_email_key" ON "OutreachMailbox"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "OutreachMailbox_organizationId_isActive_idx" ON "OutreachMailbox"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "EmailSendQueue_outreachMailboxId_idx" ON "EmailSendQueue"("outreachMailboxId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutreachMailbox_organizationId_fkey'
  ) THEN
    ALTER TABLE "OutreachMailbox"
      ADD CONSTRAINT "OutreachMailbox_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutreachMailbox_connectedByUserId_fkey'
  ) THEN
    ALTER TABLE "OutreachMailbox"
      ADD CONSTRAINT "OutreachMailbox_connectedByUserId_fkey"
      FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailSendQueue_outreachMailboxId_fkey'
  ) THEN
    ALTER TABLE "EmailSendQueue"
      ADD CONSTRAINT "EmailSendQueue_outreachMailboxId_fkey"
      FOREIGN KEY ("outreachMailboxId") REFERENCES "OutreachMailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
