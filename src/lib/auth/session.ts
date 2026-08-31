import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { CANONICAL_ORG_SLUG, isSingleOrgMode } from "@/lib/org/single-org";

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
  return {
    session,
    userId: session.user.id,
    organizationId: member.organizationId,
    role: member.role as MemberRole,
    organization: member.organization,
  };
}

export type Permission =
  | "manage_org"
  | "create_job"
  | "edit_job"
  | "move_pipeline"
  | "send_email"
  | "manage_marketing"
  | "view_analytics"
  | "admin";

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    "manage_org",
    "create_job",
    "edit_job",
    "move_pipeline",
    "send_email",
    "manage_marketing",
    "view_analytics",
    "admin",
  ],
  ADMIN: [
    "manage_org",
    "create_job",
    "edit_job",
    "move_pipeline",
    "send_email",
    "manage_marketing",
    "view_analytics",
    "admin",
  ],
  MANAGER: [
    "create_job",
    "edit_job",
    "move_pipeline",
    "send_email",
    "manage_marketing",
    "view_analytics",
  ],
  RECRUITER: [
    "create_job",
    "edit_job",
    "move_pipeline",
    "send_email",
    "view_analytics",
  ],
  MARKETING: ["manage_marketing", "send_email", "view_analytics"],
  FINANCE: ["view_analytics"],
  VIEWER: ["view_analytics"],
};

export function hasPermission(role: MemberRole, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function requirePermission(permission: Permission) {
  const ctx = await requireOrgContext();
  if (!hasPermission(ctx.role, permission)) {
    throw new Error("Forbidden");
  }
  return ctx;
}
