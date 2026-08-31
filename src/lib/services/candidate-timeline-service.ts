import { prisma } from "@/lib/db";
import { formatActivityAction } from "@/lib/activity/format";

export type TimelineEvent = {
  id: string;
  at: Date;
  category: "candidate" | "pipeline" | "email" | "marketing" | "resume";
  title: string;
  detail?: string;
  href?: string;
};

export async function getCandidateTimeline(
  candidateId: string,
  organizationId: string,
  limit = 50,
  options?: { skipLookup?: boolean },
): Promise<TimelineEvent[]> {
  if (!options?.skipLookup) {
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!candidate) return [];
  }

  const [activities, stageHistory, applications] = await Promise.all([
    prisma.candidateActivity.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.stageHistory.findMany({
      where: { application: { candidateId } },
      orderBy: { changedAt: "desc" },
      take: limit,
      include: {
        application: {
          select: { job: { select: { id: true, title: true, jobCode: true } } },
        },
        changedBy: { select: { name: true } },
      },
    }),
    prisma.application.findMany({
      where: { candidateId },
      select: {
        id: true,
        stage: true,
        createdAt: true,
        job: { select: { id: true, title: true, jobCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const activity of activities) {
    const category = activity.action.startsWith("marketing.")
      ? "marketing"
      : activity.action.startsWith("email.")
        ? "email"
        : activity.action.startsWith("resume.")
          ? "resume"
          : activity.action.startsWith("stage.")
            ? "pipeline"
            : "candidate";
    events.push({
      id: `activity:${activity.id}`,
      at: activity.createdAt,
      category,
      title: formatActivityAction(activity.action, activity.metadata),
      detail:
        activity.metadata && typeof activity.metadata === "object"
          ? JSON.stringify(activity.metadata).slice(0, 120)
          : undefined,
    });
  }

  for (const stage of stageHistory) {
    events.push({
      id: `stage:${stage.id}`,
      at: stage.changedAt,
      category: "pipeline",
      title: `Moved to ${stage.toStage.replace(/_/g, " ")}`,
      detail: `${stage.application.job.jobCode} · ${stage.application.job.title}`,
      href: `/jobs/${stage.application.job.id}?tab=applicants`,
    });
  }

  for (const app of applications) {
    events.push({
      id: `app:${app.id}`,
      at: app.createdAt,
      category: "pipeline",
      title: `Added to job pipeline (${app.stage.replace(/_/g, " ")})`,
      detail: `${app.job.jobCode} · ${app.job.title}`,
      href: `/jobs/${app.job.id}?tab=applicants`,
    });
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
