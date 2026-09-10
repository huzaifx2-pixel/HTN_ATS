import { MemberRole } from "@prisma/client";
import { cache } from "react";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import {
  ALL_FEATURE_KEYS,
  DEFAULT_ROLE_FEATURES,
  FEATURE_ROLES,
  GRANTABLE_FEATURE_KEYS,
  LOCKED_FEATURE_KEYS,
  defaultFeaturesForRole,
  isSuperadminRole,
  type EditableFeatureRole,
} from "@/lib/auth/features";

function isEditableRole(role: MemberRole): role is EditableFeatureRole {
  return (FEATURE_ROLES as readonly string[]).includes(role);
}

type FeatureRow = { feature: string; role: MemberRole; updatedAt?: Date };

function roleFeatureDelegate() {
  return (prisma as { roleFeature?: typeof prisma.roleFeature }).roleFeature;
}

export const getRoleFeatures = cache(async function getRoleFeatures(
  organizationId: string,
  role: MemberRole,
): Promise<string[]> {
  if (isSuperadminRole(role)) return ALL_FEATURE_KEYS;

  await ensureRoleFeaturesSeeded(organizationId);

  if (!isEditableRole(role)) {
    return defaultFeaturesForRole(role);
  }

  const rows = await listRoleFeatures(organizationId, role);
  return rows.map((row) => row.feature).filter((feature) => !LOCKED_FEATURE_KEYS.includes(feature));
});

export const getOrganizationRoleMatrix = cache(async function getOrganizationRoleMatrix(
  organizationId: string,
) {
  await ensureRoleFeaturesSeeded(organizationId);

  const rows = await listRoleFeatures(organizationId);
  const grants: Record<EditableFeatureRole, string[]> = {
    ADMIN: [],
    RECRUITER: [],
    EXTERNAL_RECRUITER: [],
  };

  let lastUpdated: Date | null = null;
  for (const row of rows) {
    if (!isEditableRole(row.role)) continue;
    if (LOCKED_FEATURE_KEYS.includes(row.feature)) continue;
    grants[row.role].push(row.feature);
    if (row.updatedAt && (!lastUpdated || row.updatedAt > lastUpdated)) lastUpdated = row.updatedAt;
  }

  return { grants, lastUpdated };
});

export async function saveOrganizationRoleMatrix(
  organizationId: string,
  grants: Record<EditableFeatureRole, string[]>,
) {
  const allowed = new Set(GRANTABLE_FEATURE_KEYS);
  const data = FEATURE_ROLES.flatMap((role) => {
    const unique = [...new Set(grants[role] ?? [])].filter((feature) => allowed.has(feature));
    return unique.map((feature) => ({ organizationId, role, feature }));
  });

  const delegate = roleFeatureDelegate();
  if (delegate) {
    await prisma.$transaction(async (tx) => {
      await tx.roleFeature.deleteMany({
        where: { organizationId, role: { in: [...FEATURE_ROLES] } },
      });
      if (data.length > 0) {
        await tx.roleFeature.createMany({ data });
      }
    });
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM "RoleFeature"
    WHERE "organizationId" = ${organizationId}
      AND role IN ('ADMIN'::"MemberRole", 'RECRUITER'::"MemberRole", 'EXTERNAL_RECRUITER'::"MemberRole")
  `;
  for (const row of data) {
    await insertRoleFeatureRaw(row.organizationId, row.role, row.feature);
  }
}

async function listRoleFeatures(organizationId: string, role?: MemberRole): Promise<FeatureRow[]> {
  const delegate = roleFeatureDelegate();
  if (delegate) {
    return delegate.findMany({
      where: {
        organizationId,
        ...(role ? { role } : { role: { in: [...FEATURE_ROLES] } }),
      },
      select: { role: true, feature: true, updatedAt: true },
    });
  }

  if (role) {
    return prisma.$queryRaw<FeatureRow[]>`
      SELECT feature, role, "updatedAt"
      FROM "RoleFeature"
      WHERE "organizationId" = ${organizationId} AND role = CAST(${role} AS "MemberRole")
    `;
  }

  return prisma.$queryRaw<FeatureRow[]>`
    SELECT feature, role, "updatedAt"
    FROM "RoleFeature"
    WHERE "organizationId" = ${organizationId}
      AND role IN ('ADMIN'::"MemberRole", 'RECRUITER'::"MemberRole", 'EXTERNAL_RECRUITER'::"MemberRole")
  `;
}

async function ensureRoleFeaturesSeeded(organizationId: string) {
  const existing = await countRoleFeatures(organizationId);
  if (existing > 0) return;

  const data = FEATURE_ROLES.flatMap((role) =>
    DEFAULT_ROLE_FEATURES[role].map((feature) => ({
      organizationId,
      role,
      feature,
    })),
  );
  if (data.length === 0) return;

  const delegate = roleFeatureDelegate();
  if (delegate) {
    await delegate.createMany({ data, skipDuplicates: true });
    return;
  }

  for (const row of data) {
    await insertRoleFeatureRaw(row.organizationId, row.role, row.feature);
  }
}

async function countRoleFeatures(organizationId: string) {
  const delegate = roleFeatureDelegate();
  if (delegate) {
    return delegate.count({ where: { organizationId } });
  }
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "RoleFeature" WHERE "organizationId" = ${organizationId}
  `;
  return Number(rows[0]?.count ?? 0);
}

async function insertRoleFeatureRaw(organizationId: string, role: string, feature: string) {
  await prisma.$executeRaw`
    INSERT INTO "RoleFeature" (id, "organizationId", role, feature, "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${organizationId}, CAST(${role} AS "MemberRole"), ${feature}, NOW(), NOW())
    ON CONFLICT ("organizationId", role, feature) DO NOTHING
  `;
}
