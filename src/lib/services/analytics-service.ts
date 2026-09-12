import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/constants/storage";
import { getPipelineOverview } from "@/lib/services/pipeline-service";
import { getResumeInboxCount } from "@/lib/services/gmail-service";
import { getUnreadMessageCount } from "@/lib/services/messaging-service";
import { getWorkerStatuses } from "@/lib/jobs/scheduler-status";
import { withTtlCache } from "@/lib/cache/ttl-cache";
import { timeAsync } from "@/lib/perf";

type DashboardSnapshot = {
  totalJobs: number;
  openJobs: number;
  activeCandidates: number;
  matchedToday: number;
  placements: number;
  emailsSent: number;
  emailsSentToday: number;
  emailsFailedToday: number;
  resumesImportedToday: number;
  pendingInbox: number;
  candidatesMatched: number;
  interviews: number;
  followUpCandidates: number;
  expiringJobs: number;
};

function n(value: number | bigint | null | undefined) {
  return Number(value ?? 0);
}

async function loadDashboardSnapshot(organizationId: string): Promise<DashboardSnapshot> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [rows, matchRows, appRows, emailRows] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, number | bigint>>>`
      SELECT
        (SELECT COUNT(*)::int FROM "Job" WHERE "organizationId" = ${organizationId}) AS "totalJobs",
        (SELECT COUNT(*)::int FROM "Job" WHERE "organizationId" = ${organizationId} AND status = 'OPEN') AS "openJobs",
        (SELECT COUNT(*)::int FROM "Candidate" WHERE "organizationId" = ${organizationId} AND "deletedAt" IS NULL) AS "activeCandidates",
        (SELECT COUNT(*)::int FROM "CandidateDraft" WHERE "organizationId" = ${organizationId} AND status = 'PENDING') AS "pendingInbox",
        (SELECT COUNT(*)::int FROM "Job"
          WHERE "organizationId" = ${organizationId}
            AND status = 'OPEN'
            AND "expiresAt" >= ${today}
            AND "expiresAt" <= ${inSevenDays}) AS "expiringJobs",
        (SELECT COUNT(*)::int FROM "AuditLog"
          WHERE "organizationId" = ${organizationId}
            AND action IN ('email.auto_failed', 'gmail.sync_failed')
            AND "createdAt" >= ${today}) AS "emailsFailedToday",
        (SELECT COUNT(*)::int FROM "CandidateActivity" ca
          INNER JOIN "Candidate" c ON c.id = ca."candidateId"
          WHERE c."organizationId" = ${organizationId}
            AND ca.action IN ('candidate.created', 'resume.version_added', 'resume.uploaded')
            AND ca."createdAt" >= ${today}) AS "resumesImportedToday"
    `,
    prisma.$queryRaw<Array<{
      matchedToday: number | bigint;
      candidatesMatched: number | bigint;
      followUpCandidates: number | bigint;
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE jm."computedAt" >= ${today})::int AS "matchedToday",
        COUNT(*) FILTER (WHERE jm.score >= 70)::int AS "candidatesMatched",
        COUNT(DISTINCT jm."candidateId") FILTER (WHERE jm.score >= 70)::int AS "followUpCandidates"
      FROM "Job" j
      INNER JOIN "JobMatch" jm ON jm."jobId" = j.id
      WHERE j."organizationId" = ${organizationId}
    `,
    prisma.$queryRaw<Array<{
      placements: number | bigint;
      interviews: number | bigint;
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE a.stage = 'PLACEMENT')::int AS "placements",
        COUNT(*) FILTER (WHERE a.stage = 'INTERVIEW_COMPLETED')::int AS "interviews"
      FROM "Job" j
      INNER JOIN "Application" a ON a."jobId" = j.id
      WHERE j."organizationId" = ${organizationId}
    `,
    prisma.$queryRaw<Array<{
      emailsSent: number | bigint;
      emailsSentToday: number | bigint;
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE e."sentAt" IS NOT NULL)::int AS "emailsSent",
        COUNT(*) FILTER (WHERE e."sentAt" >= ${today})::int AS "emailsSentToday"
      FROM "EmailMessage" e
      WHERE e."jobId" IN (SELECT id FROM "Job" WHERE "organizationId" = ${organizationId})
    `,
  ]);

  const base = rows[0] ?? {};
  const matches = matchRows[0] ?? { matchedToday: 0, candidatesMatched: 0, followUpCandidates: 0 };
  const apps = appRows[0] ?? { placements: 0, interviews: 0 };
  const emails = emailRows[0] ?? { emailsSent: 0, emailsSentToday: 0 };

  return {
    totalJobs: n(base.totalJobs),
    openJobs: n(base.openJobs),
    activeCandidates: n(base.activeCandidates),
    pendingInbox: n(base.pendingInbox),
    expiringJobs: n(base.expiringJobs),
    emailsFailedToday: n(base.emailsFailedToday),
    resumesImportedToday: n(base.resumesImportedToday),
    matchedToday: n(matches.matchedToday),
    candidatesMatched: n(matches.candidatesMatched),
    followUpCandidates: n(matches.followUpCandidates),
    placements: n(apps.placements),
    interviews: n(apps.interviews),
    emailsSent: n(emails.emailsSent),
    emailsSentToday: n(emails.emailsSentToday),
  };
}

function snapshotCache(organizationId: string) {
  return withTtlCache(`dashboard-snapshot:${organizationId}`, 60, () =>
    timeAsync("dashboard.metrics", () => loadDashboardSnapshot(organizationId)),
  );
}

export async function getDashboardStats(organizationId: string) {
  const snap = await snapshotCache(organizationId);
  return {
    totalJobs: snap.totalJobs,
    openJobs: snap.openJobs,
    activeCandidates: snap.activeCandidates,
    matchedToday: snap.matchedToday,
    placements: snap.placements,
    emailsSent: snap.emailsSent,
    emailsSentToday: snap.emailsSentToday,
    emailsFailedToday: snap.emailsFailedToday,
    resumesImportedToday: snap.resumesImportedToday,
    pendingInbox: snap.pendingInbox,
    candidatesMatched: snap.candidatesMatched,
    interviews: snap.interviews,
  };
}

export async function getDashboardTaskCounts(organizationId: string) {
  const snap = await snapshotCache(organizationId);
  return {
    resumeInboxCount: snap.pendingInbox,
    expiringJobs: snap.expiringJobs,
    followUpCandidates: snap.followUpCandidates,
    upcomingInterviews: snap.interviews,
  };
}

export { getRecentActivity } from "@/lib/activity/queries";

async function loadShellLayoutData(userId: string, organizationId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [pendingInboxCount, unreadMessages, memberUserIds, settings, gmailImports7d] =
    await Promise.all([
      getResumeInboxCount(organizationId),
      getUnreadMessageCount(userId),
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
          createdAt: { gte: sevenDaysAgo },
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

  const workers = getWorkerStatuses();
  const gmailWorker = workers.find((worker) => worker.name === "gmail-sync");

  return {
    pendingInboxCount,
    gmailImports7d,
    unreadMessages,
    gmailConnected: connections.length > 0,
    lastSyncAt,
    gmailSyncFailedRecently,
    gmailWorkerRunning: gmailWorker?.running ?? false,
    gmailWorkerLastError: gmailWorker?.lastError ?? null,
    teamMemberCount: memberUserIds.length,
    storageUsedBytes: Number(settings?.storageUsedBytes ?? 0),
    storageLimitBytes: Number(settings?.storageLimitBytes ?? DEFAULT_STORAGE_LIMIT_BYTES),
  };
}

export const getShellLayoutData = cache(async function getShellLayoutData(
  userId: string,
  organizationId: string,
) {
  return unstable_cache(
    () => loadShellLayoutData(userId, organizationId),
    ["shell-layout", userId, organizationId],
    { revalidate: 20 },
  )();
});

export async function getDashboardData(organizationId: string) {
  return withTtlCache(`dashboard-data:${organizationId}`, 60, () =>
    timeAsync("dashboard.data", async () => {
      const [stats, pipeline, taskCounts, settings] = await Promise.all([
        getDashboardStats(organizationId),
        getPipelineOverview(organizationId),
        getDashboardTaskCounts(organizationId),
        prisma.orgSettings.findUnique({
          where: { organizationId },
          select: { storageUsedBytes: true, storageLimitBytes: true },
        }),
      ]);

      return {
        stats,
        pipeline,
        taskCounts,
        workers: getWorkerStatuses(),
        storageUsedBytes: Number(settings?.storageUsedBytes ?? 0),
        storageLimitBytes: Number(settings?.storageLimitBytes ?? DEFAULT_STORAGE_LIMIT_BYTES),
      };
    }),
  );
}

export async function getRecruiterProductivity(organizationId: string) {
  const members = await prisma.member.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              ownedJobs: true,
              stageChanges: true,
            },
          },
        },
      },
    },
  });

  return members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    role: m.role,
    jobsOwned: m.user._count.ownedJobs,
    stageChanges: m.user._count.stageChanges,
  }));
}

export async function listAuditLogs(
  organizationId: string,
  options?: {
    limit?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
    from?: string;
    to?: string;
  },
) {
  const limit = options?.limit ?? 100;
  const fromDate = options?.from ? new Date(options.from) : undefined;
  const toDate = options?.to ? new Date(options.to) : undefined;

  return prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(options?.action ? { action: { contains: options.action, mode: "insensitive" } } : {}),
      ...(options?.entityType ? { entityType: options.entityType } : {}),
      ...(options?.actorId ? { actorId: options.actorId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOrgMembers(organizationId: string) {
  return prisma.member.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getSourceAnalytics(organizationId: string) {
  const grouped = await prisma.candidate.groupBy({
    by: ["source"],
    where: { organizationId, deletedAt: null },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      source: row.source,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getOrgEmailAnalytics(organizationId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const messages = await prisma.emailMessage.findMany({
    where: { campaign: { job: { organizationId } } },
    select: {
      sentAt: true,
      openedAt: true,
      clickedAt: true,
      repliedAt: true,
      autoSent: true,
    },
  });

  const sent = messages.filter((m) => m.sentAt);
  const sentToday = sent.filter((m) => m.sentAt && m.sentAt >= today);

  return {
    totalSent: sent.length,
    sentToday: sentToday.length,
    opened: sent.filter((m) => m.openedAt).length,
    clicked: sent.filter((m) => m.clickedAt).length,
    autoSent: sent.filter((m) => m.autoSent).length,
    openRate: sent.length ? Math.round((sent.filter((m) => m.openedAt).length / sent.length) * 100) : 0,
  };
}

export async function getMatchingAnalytics(organizationId: string) {
  const [totalMatches, highMatches, avgScore] = await Promise.all([
    prisma.jobMatch.count({ where: { job: { organizationId } } }),
    prisma.jobMatch.count({ where: { job: { organizationId }, score: { gte: 70 } } }),
    prisma.jobMatch.aggregate({
      where: { job: { organizationId } },
      _avg: { score: true },
    }),
  ]);

  return {
    totalMatches,
    highMatches,
    averageScore: Math.round(avgScore._avg.score ?? 0),
  };
}

export async function getParserAnalytics(organizationId: string) {
  const resumes = await prisma.parsedResume.findMany({
    where: { candidate: { organizationId, deletedAt: null } },
    select: { parserVersion: true, parseMetadata: true, structured: true },
  });

  const byVersion = new Map<string, number>();
  let ocrCount = 0;
  let needsReview = 0;
  let missingSectionCount = 0;

  for (const row of resumes) {
    const version = row.parserVersion ?? "unknown";
    byVersion.set(version, (byVersion.get(version) ?? 0) + 1);
    const meta = row.parseMetadata && typeof row.parseMetadata === "object"
      ? (row.parseMetadata as Record<string, unknown>)
      : {};
    const document = (meta.document ?? (row.structured as { document?: { ocrUsed?: boolean } } | null)?.document) as
      | { ocrUsed?: boolean }
      | undefined;
    if (document?.ocrUsed) ocrCount += 1;
    const quality = (meta.quality ?? (row.structured as { quality?: { missingSections?: string[] } } | null)?.quality) as
      | { missingSections?: string[] }
      | undefined;
    if (quality?.missingSections?.length) missingSectionCount += 1;
    const structured = row.structured as { experience?: Array<{ jobTitle?: { reviewStatus?: string } }> } | null;
    if (structured?.experience?.some((job) => job.jobTitle?.reviewStatus === "needs_review")) {
      needsReview += 1;
    }
  }

  return {
    total: resumes.length,
    byVersion: [...byVersion.entries()].map(([version, count]) => ({ version, count })),
    ocrRate: resumes.length ? Math.round((ocrCount / resumes.length) * 100) : 0,
    needsReview,
    missingSections: missingSectionCount,
  };
}
