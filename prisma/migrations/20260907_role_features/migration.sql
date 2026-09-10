-- AlterEnum
ALTER TYPE "MemberRole" ADD VALUE 'EXTERNAL_RECRUITER';

-- CreateTable
CREATE TABLE "RoleFeature" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "feature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleFeature_organizationId_role_idx" ON "RoleFeature"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleFeature_organizationId_role_feature_key" ON "RoleFeature"("organizationId", "role", "feature");

-- AddForeignKey
ALTER TABLE "RoleFeature" ADD CONSTRAINT "RoleFeature_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
