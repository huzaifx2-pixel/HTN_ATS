import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { CANONICAL_ORG_SLUG, isSingleOrgMode } from "@/lib/org/single-org";
import type { Permission } from "@/lib/auth/session-types";
import { isSuperadminRole, permissionsForFeatures } from "@/lib/auth/features";
import { getRoleFeatures } from "@/lib/services/role-feature-service";

export type { Permission } from "@/lib/auth/session-types";

export const getSession = cache(async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export const getActiveOrganization = cache(async function getActiveOrganization(userId: string) {
  const memberSelect = {
    id: true,
    role: true,
    organizationId: true,
    userId: true,
    createdAt: true,
    organization: { select: { id: true, name: true, slug: true } },
  } as const;

  if (isSingleOrgMode()) {
    const canonicalMember = await prisma.member.findFirst({
      where: {
        userId,
        organization: { slug: CANONICAL_ORG_SLUG },
      },
      select: memberSelect,
    });
    if (canonicalMember) return canonicalMember;
  }

  return prisma.member.findFirst({
    where: { userId },
    select: memberSelect,
    orderBy: { createdAt: "asc" },
  });
});

export async function requireOrgContext() {
  const session = await requireSession();
  const member = await getActiveOrganization(session.user.id);
  if (!member) {
    throw new Error("No organization found");
  }
  const features = await getRoleFeatures(member.organizationId, member.role as MemberRole);
  return {
    session,
    userId: session.user.id,
    organizationId: member.organizationId,
    role: member.role as MemberRole,
    organization: member.organization,
    features,
  };
}

export function hasPermission(
  role: MemberRole,
  permission: Permission,
  features: Iterable<string> = [],
) {
  if (isSuperadminRole(role)) return true;
  if (permission === "manage_users") return false;
  return permissionsForFeatures(features).has(permission);
}

export async function requirePermission(permission: Permission) {
  const ctx = await requireOrgContext();
  if (!hasPermission(ctx.role, permission, ctx.features)) {
    throw new Error("Forbidden");
  }
  return ctx;
}

export async function requireSuperadmin() {
  const ctx = await requireOrgContext();
  if (!isSuperadminRole(ctx.role)) {
    throw new Error("Only the organization superadmin can manage users and roles.");
  }
  return ctx;
}

export async function requireFeature(feature: string) {
  const ctx = await requireOrgContext();
  if (isSuperadminRole(ctx.role)) return ctx;
  if (!ctx.features.includes(feature)) {
    throw new Error("Forbidden");
  }
  return ctx;
}
