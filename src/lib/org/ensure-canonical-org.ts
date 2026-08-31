import { prisma } from "@/lib/db";
import { CANONICAL_ORG_NAME, CANONICAL_ORG_SLUG } from "@/lib/org/single-org";
import type { MemberRole } from "@prisma/client";

export async function getOrCreateCanonicalOrganization(creatorUserId?: string) {
  const existing = await prisma.organization.findUnique({
    where: { slug: CANONICAL_ORG_SLUG },
  });

  if (existing) return existing;

  return prisma.organization.create({
    data: {
      name: CANONICAL_ORG_NAME,
      slug: CANONICAL_ORG_SLUG,
      members: creatorUserId
        ? {
            create: {
              userId: creatorUserId,
              role: "OWNER",
            },
          }
        : undefined,
      orgSettings: {
        create: {
          matchingWeights: { skills: 40, experience: 25, title: 20, location: 15 },
        },
      },
    },
  });
}

export async function ensureUserInCanonicalOrg(userId: string, role: MemberRole = "RECRUITER") {
  const org = await getOrCreateCanonicalOrganization(userId);

  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId,
      },
    },
    create: {
      organizationId: org.id,
      userId,
      role,
    },
    update: {},
  });

  return org;
}

/** Add every account to Headsbase Consulting so LAN users share one dataset. */
export async function consolidateAllUsersToCanonicalOrg() {
  const org = await getOrCreateCanonicalOrganization();
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  let added = 0;
  for (const user of users) {
    const existing = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
    });
    if (existing) continue;

    await prisma.member.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "RECRUITER",
      },
    });
    added += 1;
  }

  return { organizationId: org.id, slug: org.slug, name: org.name, users: users.length, added };
}
