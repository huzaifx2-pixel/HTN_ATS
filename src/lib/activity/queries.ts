import { prisma } from "@/lib/db";
import { timeAsync } from "@/lib/perf";
import { formatActivityAction, isMarketingActivityAction } from "@/lib/activity/format";
import type { ActivityRow, ActivityStream } from "@/lib/activity/types";

async function loadActors(actorIds: string[]) {
  if (actorIds.length === 0) return new Map<string, { name: string }>();
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, { name: user.name }]));
}

export async function getJobActivityFeed(organizationId: string, limit = 30): Promise<ActivityRow[]> {
  return timeAsync("activity.jobs", async () => {
    const rows = await prisma.jobActivity.findMany({
      where: { job: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            jobCode: true,
            clientId: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    const actors = await loadActors(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id)));

    return rows.map((row) => ({
      id: `job:${row.id}`,
      stream: "job" as const,
      action: row.action,
      actionLabel: formatActivityAction(row.action, row.metadata),
      createdAt: row.createdAt,
      actorName: row.actorId ? actors.get(row.actorId)?.name ?? "System" : "System",
      actorHref: row.actorId ? `/admin/users?user=${row.actorId}` : undefined,
      entityLabel: row.job.title,
      entityHref: `/jobs/${row.job.id}`,
      secondaryLabel: row.job.client.name,
      secondaryHref: `/admin/clients?client=${row.job.client.id}`,
      metadata: row.metadata,
    }));
  });
}

export async function getCandidateActivityFeed(organizationId: string, limit = 30): Promise<ActivityRow[]> {
  return timeAsync("activity.candidates", async () => {
    const rows = await prisma.candidateActivity.findMany({
      where: {
        candidate: { organizationId },
        NOT: { action: { startsWith: "marketing." } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        candidate: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return rows.map((row) => ({
      id: `candidate:${row.id}`,
      stream: "candidate" as const,
      action: row.action,
      actionLabel: formatActivityAction(row.action, row.metadata),
      createdAt: row.createdAt,
      actorName: "System",
      entityLabel: `${row.candidate.firstName} ${row.candidate.lastName}`.trim(),
      entityHref: `/candidates/${row.candidate.id}`,
      metadata: row.metadata,
    }));
  });
}

export async function getMarketingActivityFeed(organizationId: string, limit = 30): Promise<ActivityRow[]> {
  return timeAsync("activity.marketing", async () => {
    const [candidateRows, campaigns] = await Promise.all([
      prisma.candidateActivity.findMany({
        where: {
          candidate: { organizationId },
          action: { startsWith: "marketing." },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          candidate: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.marketingCampaign.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, name: true, status: true, updatedAt: true, createdAt: true },
      }),
    ]);

    const campaignRows: ActivityRow[] = campaigns.map((campaign) => ({
      id: `marketing-campaign:${campaign.id}`,
      stream: "marketing" as const,
      action: `campaign.${campaign.status.toLowerCase()}`,
      actionLabel: `Campaign ${campaign.status.toLowerCase()}`,
      createdAt: campaign.updatedAt,
      actorName: "System",
      entityLabel: campaign.name,
      entityHref: `/marketing/campaigns/${campaign.id}`,
    }));

    const activityRows: ActivityRow[] = candidateRows.map((row) => ({
      id: `marketing:${row.id}`,
      stream: "marketing" as const,
      action: row.action,
      actionLabel: formatActivityAction(row.action, row.metadata),
      createdAt: row.createdAt,
      actorName: "System",
      entityLabel: `${row.candidate.firstName} ${row.candidate.lastName}`.trim() || row.candidate.email || "Recipient",
      entityHref: `/marketing/audiences`,
      metadata: row.metadata,
    }));

    return [...campaignRows, ...activityRows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  });
}

export async function getFinanceActivityFeed(organizationId: string, limit = 30): Promise<ActivityRow[]> {
  return timeAsync("activity.finance", async () => {
    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          { entityType: { in: ["Invoice", "Payment", "Placement", "Commission", "Expense"] } },
          { action: { contains: "invoice" } },
          { action: { contains: "payment" } },
          { action: { contains: "commission" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { id: true, name: true } } },
    });

    return rows.map((row) => ({
      id: `finance:${row.id}`,
      stream: "finance" as const,
      action: row.action,
      actionLabel: formatActivityAction(row.action, row.metadata),
      createdAt: row.createdAt,
      actorName: row.actor?.name ?? "System",
      actorHref: row.actor?.id ? `/admin/users?user=${row.actor.id}` : undefined,
      entityLabel: row.entityType,
      entityHref: row.entityId ? `/admin/logs?entity=${row.entityId}` : undefined,
      metadata: row.metadata,
    }));
  });
}

export async function getActivityFeed(
  organizationId: string,
  options?: { stream?: ActivityStream; limit?: number },
): Promise<ActivityRow[]> {
  const stream = options?.stream ?? "all";
  const limit = options?.limit ?? 30;

  if (stream === "job") return getJobActivityFeed(organizationId, limit);
  if (stream === "candidate") return getCandidateActivityFeed(organizationId, limit);
  if (stream === "marketing") return getMarketingActivityFeed(organizationId, limit);
  if (stream === "finance") return getFinanceActivityFeed(organizationId, limit);

  const [jobs, candidates, marketing, finance] = await Promise.all([
    getJobActivityFeed(organizationId, limit),
    getCandidateActivityFeed(organizationId, limit),
    getMarketingActivityFeed(organizationId, limit),
    getFinanceActivityFeed(organizationId, limit),
  ]);

  const seen = new Set<string>();
  return [...jobs, ...candidates, ...marketing, ...finance]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((row) => {
      const key = `${row.stream}:${row.action}:${row.entityLabel}:${row.createdAt.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Backward-compatible dashboard feed (mixed, compact). */
export async function getRecentActivity(organizationId: string, limit = 10) {
  const rows = await getActivityFeed(organizationId, { stream: "all", limit });
  return rows.map((row) => ({
    id: row.id,
    type: row.stream,
    action: row.action,
    detail: row.entityLabel,
    meta: row.actorName,
    createdAt: row.createdAt,
    href: row.entityHref,
    actionLabel: row.actionLabel,
  }));
}

export function filterMarketingFromCandidateActions(action: string) {
  return !isMarketingActivityAction(action);
}
