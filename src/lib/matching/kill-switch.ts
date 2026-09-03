import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const MATCHING_KILLED_FLAG = "matchingKilled";
export const MATCHING_PARKED_UNTIL = new Date("2099-01-01T00:00:00.000Z");

const cache = new Map<string, boolean>();

function readKilledFlag(flags: Prisma.JsonValue | null | undefined): boolean {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return false;
  return (flags as Record<string, unknown>)[MATCHING_KILLED_FLAG] === true;
}

export async function loadMatchingKillSwitchCache() {
  try {
    const rows = await prisma.orgSettings.findMany({
      select: { organizationId: true, featureFlags: true },
    });
    cache.clear();
    for (const row of rows) {
      cache.set(row.organizationId, readKilledFlag(row.featureFlags));
    }
  } catch (error) {
    console.error("[matching] failed to load kill switch:", error);
  }
}

export async function isMatchingKilled(organizationId: string): Promise<boolean> {
  if (cache.has(organizationId)) return cache.get(organizationId) === true;

  try {
    const row = await prisma.orgSettings.findUnique({
      where: { organizationId },
      select: { featureFlags: true },
    });
    const killed = readKilledFlag(row?.featureFlags);
    cache.set(organizationId, killed);
    return killed;
  } catch (error) {
    console.error("[matching] kill switch lookup failed:", error);
    return cache.get(organizationId) === true;
  }
}

export async function getMatchingKillSwitchState(organizationId: string) {
  const [killed, queued] = await Promise.all([
    isMatchingKilled(organizationId),
    prisma.matchWorkItem.count({
      where: {
        organizationId,
        status: { in: ["PENDING", "PROCESSING"] },
        runAfter: { lt: MATCHING_PARKED_UNTIL },
      },
    }),
  ]);
  return { killed, queued };
}

async function persistFlag(organizationId: string, killed: boolean) {
  const existing = await prisma.orgSettings.findUnique({
    where: { organizationId },
    select: { featureFlags: true },
  });
  const flags =
    existing?.featureFlags && typeof existing.featureFlags === "object" && !Array.isArray(existing.featureFlags)
      ? { ...(existing.featureFlags as Record<string, unknown>) }
      : {};
  flags[MATCHING_KILLED_FLAG] = killed;

  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      featureFlags: flags as Prisma.InputJsonValue,
    },
    update: {
      featureFlags: flags as Prisma.InputJsonValue,
    },
  });
}

export async function parkOrganizationMatchWork(organizationId: string) {
  await prisma.matchWorkItem.updateMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: {
      status: "PENDING",
      runAfter: MATCHING_PARKED_UNTIL,
      lastError: "Matching kill switch is on",
    },
  });
}

export async function parkMatchWorkItem(id: string) {
  await prisma.matchWorkItem.update({
    where: { id },
    data: {
      status: "PENDING",
      runAfter: MATCHING_PARKED_UNTIL,
      lastError: "Matching kill switch is on",
    },
  });
}

async function unparkOrganizationMatchWork(organizationId: string) {
  await prisma.matchWorkItem.updateMany({
    where: {
      organizationId,
      status: "PENDING",
      runAfter: { gte: MATCHING_PARKED_UNTIL },
    },
    data: {
      runAfter: new Date(),
      lastError: null,
    },
  });
}

export async function setMatchingKilled(organizationId: string, killed: boolean) {
  cache.set(organizationId, killed);
  await persistFlag(organizationId, killed);

  if (killed) {
    await parkOrganizationMatchWork(organizationId);
    console.info(`[matching] kill switch ON for org ${organizationId}`);
  } else {
    await unparkOrganizationMatchWork(organizationId);
    console.info(`[matching] kill switch OFF for org ${organizationId}`);
  }

  return killed;
}
