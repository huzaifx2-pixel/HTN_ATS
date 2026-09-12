import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  getDashboardData,
  getRecentActivity,
  getRecruiterProductivity,
} from "@/lib/services/analytics-service";
import { getJobActivityFeed } from "@/lib/activity/queries";
import { countJobsWithPendingMatchEmails } from "@/lib/services/match-email-outreach-service";
import { getRecruitmentFunnel } from "@/lib/services/recruitment-funnel-service";
import { getIslamicQuoteForSession, type IslamicQuote } from "@/lib/islamic-quotes";
import { prisma } from "@/lib/db";

export type PreviewKpi = {
  key: string;
  label: string;
  value: number;
  href: string;
  changePercent: number;
  trend: "UP" | "DOWN" | "FLAT";
  sparkline: number[];
  mockTrend: boolean;
};

export type PreviewAttentionItem = {
  type: string;
  label: string;
  count: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  actionLabel: string;
  href: string;
  mock?: boolean;
};

export type PreviewFunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type PreviewJobHealthBucket = {
  key: string;
  label: string;
  count: number;
  color: string;
};

export type PreviewRecruiter = {
  id: string;
  name: string;
  jobsOwned: number;
  submissions: number;
  score: number;
  mockScore: boolean;
};

export type PreviewActivityItem = {
  id: string;
  title: string;
  detail: string;
  createdAt: Date;
  href?: string;
};

export type PreviewTaskItem = {
  id: string;
  title: string;
  meta: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  bucket: "today" | "overdue" | "upcoming";
  href: string;
  overdueCount?: number;
};

export type ExecutiveDashboardPreviewData = {
  meta: {
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
    userFirstName: string;
    quote: IslamicQuote;
  };
  aiMatchReview: {
    count: number;
    href: string;
  };
  kpis: PreviewKpi[];
  attention: PreviewAttentionItem[];
  funnel: { stages: PreviewFunnelStage[] };
  jobHealth: {
    totalOpen: number;
    buckets: PreviewJobHealthBucket[];
    mock: boolean;
  };
  recruiters: PreviewRecruiter[];
  jobActivity: PreviewActivityItem[];
  recentActivity: PreviewActivityItem[];
  tasks: {
    total: number;
    overdue: number;
    today: number;
    items: PreviewTaskItem[];
  };
};

function sparklineFromSeed(seed: number, points = 8): number[] {
  const base = Math.max(1, seed);
  return Array.from({ length: points }, (_, i) => {
    const wave = Math.sin((i + 1) * 0.9 + (seed % 7)) * 0.12;
    const drift = (i / (points - 1)) * 0.18;
    return Math.max(0.2, 0.55 + wave + drift) * base;
  });
}

function mockChangePercent(seed: number): { changePercent: number; trend: PreviewKpi["trend"] } {
  const changePercent = Math.round((((seed % 17) - 3) / 2) * 10) / 10;
  if (changePercent > 0.2) return { changePercent, trend: "UP" };
  if (changePercent < -0.2) return { changePercent: Math.abs(changePercent), trend: "DOWN" };
  return { changePercent: 0, trend: "FLAT" };
}

function greetingFirstName(fullName: string | null | undefined) {
  const name = (fullName ?? "there").trim();
  return name.split(/\s+/)[0] || "there";
}

export async function getExecutiveDashboardPreviewData(
  organizationId: string,
  userName?: string | null,
  sessionId?: string | null,
): Promise<ExecutiveDashboardPreviewData> {
  const now = new Date();
  const periodStart = startOfMonth(now);
  const periodEnd = endOfMonth(now);

  const [
    { stats, taskCounts },
    activities,
    recruiters,
    pendingMatchJobs,
    jobActivityRows,
    closedJobs,
    recruitmentFunnel,
  ] = await Promise.all([
    getDashboardData(organizationId),
    getRecentActivity(organizationId, 8),
    getRecruiterProductivity(organizationId),
    countJobsWithPendingMatchEmails(organizationId),
    getJobActivityFeed(organizationId, 6),
    prisma.job.count({
      where: { organizationId, status: { in: ["CLOSED", "FILLED"] } },
    }),
    getRecruitmentFunnel(organizationId),
  ]);

  const openJobs = stats.openJobs;
  // Preview-only health split — not a production rules engine
  const closingSoon = Math.min(taskCounts.expiringJobs || Math.round(openJobs * 0.05), openJobs);
  const atRisk = Math.min(Math.max(7, Math.round(openJobs * 0.08)), Math.max(0, openJobs - closingSoon));
  const stalled = Math.min(Math.max(12, Math.round(openJobs * 0.12)), Math.max(0, openJobs - closingSoon - atRisk));
  const healthyOpen = Math.max(0, openJobs - closingSoon - atRisk - stalled);
  const jobsWithoutQualified = Math.min(18, Math.max(3, Math.round(openJobs * 0.05)));
  const jobsOverSla = Math.min(atRisk, Math.max(3, Math.round(openJobs * 0.02)));

  const kpiDefs: Array<{ key: string; label: string; value: number; href: string }> = [
    { key: "openJobs", label: "Open Jobs", value: openJobs, href: "/jobs" },
    { key: "placements", label: "Placements", value: stats.placements, href: "/analytics" },
    { key: "applications", label: "Applications", value: stats.candidatesMatched, href: "/analytics" },
    { key: "candidates", label: "Candidates", value: stats.activeCandidates, href: "/candidates" },
    { key: "emailsSent", label: "Emails Sent", value: stats.emailsSent, href: "/analytics/email" },
  ];

  const kpis: PreviewKpi[] = kpiDefs.map((def) => {
    const { changePercent, trend } = mockChangePercent(def.value + def.key.length * 11);
    return {
      ...def,
      changePercent,
      trend,
      sparkline: sparklineFromSeed(def.value || 10),
      mockTrend: true,
    };
  });

  const funnelRaw: PreviewFunnelStage[] = recruitmentFunnel.stages;

  const topRecruiters = [...recruiters]
    .sort((a, b) => b.stageChanges - a.stageChanges || b.jobsOwned - a.jobsOwned)
    .slice(0, 5)
    .map((r, index) => {
      const score = Math.min(99, Math.max(55, 70 + r.stageChanges * 2 + r.jobsOwned + (5 - index) * 3));
      return {
        id: r.id,
        name: r.name,
        jobsOwned: r.jobsOwned,
        submissions: r.stageChanges,
        score,
        mockScore: true,
      };
    });

  const followUp = taskCounts.followUpCandidates;
  const overdueFollowUp = Math.min(followUp, Math.max(0, Math.round(followUp * 0.027)));

  const taskItems: PreviewTaskItem[] = [
    {
      id: "follow-up",
      title: "Follow up with candidates",
      meta: `${followUp.toLocaleString()} pending`,
      priority: "HIGH",
      bucket: "today",
      href: "/matching?tab=follow-up",
      overdueCount: overdueFollowUp,
    },
    {
      id: "resume-inbox",
      title: "Review resume inbox",
      meta: `${taskCounts.resumeInboxCount} items · Today`,
      priority: "MEDIUM",
      bucket: "today",
      href: "/candidates/inbox",
    },
    {
      id: "expiring-jobs",
      title: "Jobs expiring soon",
      meta: `${taskCounts.expiringJobs} jobs · Tomorrow`,
      priority: "LOW",
      bucket: "upcoming",
      href: "/jobs",
    },
    {
      id: "pending-match",
      title: "Pending match emails",
      meta: `${pendingMatchJobs} jobs need review`,
      priority: "HIGH",
      bucket: "today",
      href: "/dashboard?tab=pending-email",
    },
  ];

  return {
    meta: {
      periodLabel: `${format(periodStart, "MMM d")} – ${format(periodEnd, "MMM d, yyyy")}`,
      periodStart: format(periodStart, "yyyy-MM-dd"),
      periodEnd: format(periodEnd, "yyyy-MM-dd"),
      generatedAt: now.toISOString(),
      userFirstName: greetingFirstName(userName),
      quote: getIslamicQuoteForSession(sessionId || organizationId),
    },
    aiMatchReview: {
      count: pendingMatchJobs,
      href: "/dashboard?tab=pending-email",
    },
    kpis,
    attention: [
      {
        type: "JOB_NO_QUALIFIED_CANDIDATES",
        label: "Jobs without qualified candidates",
        count: jobsWithoutQualified,
        severity: "HIGH",
        actionLabel: "Review Jobs",
        href: "/jobs",
        mock: true,
      },
      {
        type: "JOB_OVER_SLA",
        label: "Jobs over SLA",
        count: jobsOverSla,
        severity: "HIGH",
        actionLabel: "Review",
        href: "/jobs",
        mock: true,
      },
      {
        type: "MATCH_REVIEW_PENDING",
        label: "AI matches pending",
        count: pendingMatchJobs,
        severity: "MEDIUM",
        actionLabel: "Review Matches",
        href: "/dashboard?tab=pending-email",
      },
      {
        type: "RESUME_INBOX",
        label: "Resumes awaiting review",
        count: taskCounts.resumeInboxCount,
        severity: "MEDIUM",
        actionLabel: "Open Resume Inbox",
        href: "/candidates/inbox",
      },
    ],
    funnel: { stages: funnelRaw },
    jobHealth: {
      totalOpen: openJobs,
      mock: true,
      buckets: [
        { key: "open", label: "Open", count: healthyOpen, color: "#2563eb" },
        { key: "closing_soon", label: "Closing Soon", count: closingSoon, color: "#f59e0b" },
        { key: "at_risk", label: "At Risk", count: atRisk, color: "#ef4444" },
        { key: "stalled", label: "Stalled", count: stalled, color: "#94a3b8" },
        { key: "closed", label: "Closed", count: closedJobs, color: "#64748b" },
      ],
    },
    recruiters: topRecruiters,
    jobActivity: jobActivityRows
      .filter((row) => row.entityHref?.startsWith("/jobs/"))
      .map((row) => ({
        id: row.id,
        title: row.actionLabel,
        detail: [row.actorName, row.entityLabel].filter(Boolean).join(" · "),
        createdAt: row.createdAt,
        href: row.entityHref ?? undefined,
      })),
    recentActivity: activities.map((a) => ({
      id: a.id,
      title: a.actionLabel ?? a.action,
      detail: [a.detail, a.meta].filter(Boolean).join(" · "),
      createdAt: a.createdAt,
      href: a.href,
    })),
    tasks: {
      total: taskItems.reduce((sum, t) => {
        const match = t.meta.match(/^([\d,]+)/);
        return sum + (match ? Number(match[1].replace(/,/g, "")) : 1);
      }, 0),
      overdue: overdueFollowUp,
      today: taskItems.filter((t) => t.bucket === "today").length,
      items: taskItems,
    },
  };
}
