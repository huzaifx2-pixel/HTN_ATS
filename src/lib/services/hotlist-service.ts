import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function listHotlists(organizationId: string) {
  return prisma.candidateHotlist.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { members: true } } },
  });
}

export async function getHotlist(hotlistId: string, organizationId: string) {
  return prisma.candidateHotlist.findFirst({
    where: { id: hotlistId, organizationId },
    include: {
      members: {
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              currentRole: true,
              currentCompany: true,
              email: true,
              location: true,
            },
          },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });
}

export async function createHotlist(input: { name: string; description?: string }) {
  const ctx = await requirePermission("edit_job");
  return prisma.candidateHotlist.create({
    data: {
      organizationId: ctx.organizationId,
      createdById: ctx.userId,
      name: input.name,
      description: input.description,
    },
  });
}

export async function addCandidatesToHotlist(hotlistId: string, candidateIds: string[]) {
  const ctx = await requirePermission("edit_job");
  const hotlist = await prisma.candidateHotlist.findFirst({
    where: { id: hotlistId, organizationId: ctx.organizationId },
  });
  if (!hotlist) throw new Error("Hotlist not found");

  const valid = await prisma.candidate.findMany({
    where: { id: { in: candidateIds }, organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true },
  });

  await prisma.candidateHotlistMember.createMany({
    data: valid.map((c) => ({ hotlistId, candidateId: c.id })),
    skipDuplicates: true,
  });

  return { added: valid.length };
}

export async function removeCandidateFromHotlist(hotlistId: string, candidateId: string) {
  const ctx = await requirePermission("edit_job");
  await prisma.candidateHotlistMember.deleteMany({
    where: {
      hotlistId,
      candidateId,
      hotlist: { organizationId: ctx.organizationId },
    },
  });
}
