-- Org storage limits are configured in GB (default 200 GB, max 2048 GB).
-- Those values do not fit in INT4 (~2 GB).
ALTER TABLE "OrgSettings"
  ALTER COLUMN "storageUsedBytes" SET DATA TYPE BIGINT,
  ALTER COLUMN "storageLimitBytes" SET DATA TYPE BIGINT,
  ALTER COLUMN "storageLimitBytes" SET DEFAULT 214748364800;

-- Previous schema default was INT4 max (~2 GB), not a user-chosen limit.
UPDATE "OrgSettings"
SET "storageLimitBytes" = 214748364800
WHERE "storageLimitBytes" = 2147483647;
