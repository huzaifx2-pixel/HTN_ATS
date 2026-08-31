import { prisma } from "@/lib/db";
import type { Prisma, SavedViewEntity } from "@prisma/client";

export async function listSavedViews(
  organizationId: string,
  userId: string,
  entityType: SavedViewEntity,
) {
  return prisma.savedView.findMany({
    where: { organizationId, userId, entityType },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveSavedView(
  organizationId: string,
  userId: string,
  input: { entityType: SavedViewEntity; name: string; filters: Prisma.InputJsonValue },
) {
  return prisma.savedView.create({
    data: {
      organizationId,
      userId,
      entityType: input.entityType,
      name: input.name,
      filters: input.filters,
    },
  });
}

export async function deleteSavedView(organizationId: string, userId: string, viewId: string) {
  return prisma.savedView.deleteMany({
    where: { id: viewId, organizationId, userId },
  });
}
