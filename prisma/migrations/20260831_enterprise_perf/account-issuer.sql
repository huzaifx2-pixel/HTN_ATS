ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "issuer" TEXT;

UPDATE "Account"
SET "issuer" = 'local:credential'
WHERE "providerId" = 'credential'
  AND ("issuer" IS NULL OR "issuer" = '');
