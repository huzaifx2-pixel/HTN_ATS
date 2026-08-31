import { prisma } from "@/lib/db";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/constants/storage";
import { countOnlineMembers } from "@/lib/realtime/presence";
import { getWorkerStatuses } from "@/lib/jobs/scheduler-status";
import type { StatusBarSnapshot } from "@/lib/types/status-bar";

export type { StatusBarSnapshot } from "@/lib/types/status-bar";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function getStatusBarSnapshot(organizationId: string): Promise<StatusBarSnapshot> {
  const today = startOfToday();

  const [pendingInboxCount, memberUserIds, settings, gmailImportsToday] = await Promise.all([
    prisma.candidateDraft.count({
      where: { organizationId, status: "PENDING" },
    }),
    prisma.member.findMany({
      where: { organizationId },
      select: { userId: true },
    }),
    prisma.orgSettings.findUnique({
      where: { organizationId },
      select: { storageUsedBytes: true, storageLimitBytes: true },
    }),
    prisma.resumeImportBatch.count({
      where: {
        organizationId,
        source: "GMAIL",
        status: "SUCCESS",
        createdAt: { gte: today },
      },
    }),
  ]);

  const connections = await prisma.gmailConnection.findMany({
    where: { userId: { in: memberUserIds.map((member) => member.userId) } },
    select: { lastSyncAt: true },
  });

  const lastSyncAt = connections.reduce<Date | null>((latest, connection) => {
    if (!connection.lastSyncAt) return latest;
    if (!latest || connection.lastSyncAt > latest) return connection.lastSyncAt;
    return latest;
  }, null);

  const gmailSyncFailedRecently = await prisma.auditLog.count({
    where: {
      organizationId,
      action: "gmail.sync_failed",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  // Touch worker registry so scheduler metadata stays warm in long-lived processes.
  getWorkerStatuses();

  return {
    gmailImportsToday,
    pendingInboxCount,
    gmailConnected: connections.length > 0,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    gmailSyncFailedRecently,
    onlineCount: countOnlineMembers(organizationId),
    teamMemberCount: memberUserIds.length,
    storageUsedBytes: Number(settings?.storageUsedBytes ?? 0),
    storageLimitBytes: Number(settings?.storageLimitBytes ?? DEFAULT_STORAGE_LIMIT_BYTES),
  };
}
