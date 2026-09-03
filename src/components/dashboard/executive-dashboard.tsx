import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/dashboard-widgets";
import { PipelineFunnel, ActivityFeed } from "@/components/shared/pipeline-funnel";
import { getDashboardData, getRecentActivity, getRecruiterProductivity } from "@/lib/services/analytics-service";
import { getMarketingDashboardStats } from "@/lib/services/marketing-campaign-service";
import { prisma } from "@/lib/db";
import { withPagePerf } from "@/lib/perf";
import {
  Briefcase,
  Users,
  FileText,
  Send,
  Trophy,
  DollarSign,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

async function getJobStatusBreakdown(organizationId: string) {
  const grouped = await prisma.job.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { _all: true },
  });
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0) || 1;
  return grouped.map((row) => ({
    status: row.status,
    count: row._count._all,
    pct: Math.round((row._count._all / total) * 1000) / 10,
  }));
}

function jobStatusHref(status: string) {
  if (status === "ON_HOLD") return "/jobs?view=on_hold";
  if (status === "CLOSED" || status === "FILLED") return "/jobs?view=closed";
  return "/jobs";
}

async function getRecentJobActivities(organizationId: string) {
  const jobs = await prisma.job.findMany({
    where: { organizationId },
    select: { id: true },
    take: 50,
  });
  if (jobs.length === 0) return [];
  const activities = await prisma.auditLog.findMany({
    where: {
      organizationId,
      entityType: "Job",
      entityId: { in: jobs.map((j) => j.id) },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { actor: { select: { name: true } } },
  });
  return activities.map((log) => ({
    id: log.id,
    jobId: log.entityId,
    action: log.action,
    detail: log.actor?.name ?? "System",
    createdAt: log.createdAt,
  }));
}

export async function ExecutiveDashboard({ organizationId }: { organizationId: string }) {
  return withPagePerf("executive-dashboard", async () => {
    const [{ stats, pipeline, taskCounts }, activities, recruiters, marketing, jobStatus, jobActivities] =
      await Promise.all([
        getDashboardData(organizationId),
        getRecentActivity(organizationId, 6),
        getRecruiterProductivity(organizationId),
        getMarketingDashboardStats(organizationId),
        getJobStatusBreakdown(organizationId),
        getRecentJobActivities(organizationId),
      ]);

    const topRecruiters = [...recruiters]
      .sort((a, b) => b.stageChanges - a.stageChanges)
      .slice(0, 5);

    const submissions = pipeline
      .filter((row) => !["NOT_APPLIED", "APPLYING"].includes(row.stage))
      .reduce((sum, row) => sum + row.count, 0);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0f172a]">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Overview of your staffing business performance
            </p>
          </div>
          <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
            {format(new Date(), "MMM d")} – {format(new Date(), "MMM d, yyyy")}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard label="Open Jobs" value={stats.openJobs} icon={Briefcase} trend={12} href="/jobs" />
          <StatCard label="Total Candidates" value={stats.activeCandidates} icon={Users} trend={8.3} href="/candidates" />
          <StatCard label="Applications" value={stats.candidatesMatched} icon={FileText} trend={15.6} href="/analytics" />
          <StatCard label="Submissions" value={submissions} icon={Send} trend={10.2} href="/jobs" />
          <StatCard label="Placements" value={stats.placements} icon={Trophy} trend={14.3} href="/analytics" />
          <StatCard label="Emails Sent" value={stats.emailsSent} icon={DollarSign} trend={18.7} href="/analytics/email" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="lg:col-span-1">
            <PipelineFunnel data={pipeline} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <Link href="/jobs" className="hover:text-brand-700 hover:underline">
                  Job Status
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {jobStatus.map((row) => (
                <Link
                  key={row.status}
                  href={jobStatusHref(row.status)}
                  className="flex items-center justify-between rounded-md px-1 -mx-1 py-1 text-sm hover:bg-muted/60"
                >
                  <span className="capitalize">{row.status.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="font-medium">
                    {row.count} <span className="text-muted-foreground">({row.pct}%)</span>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <Link href="/analytics/recruiters" className="hover:text-brand-700 hover:underline">
                  Top Performing Recruiters
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topRecruiters.map((recruiter, index) => (
                <Link key={recruiter.id} href="/analytics/recruiters" className="flex items-center gap-3 rounded-md px-1 -mx-1 py-1 hover:bg-muted/60">
                  <span className="w-4 text-xs text-muted-foreground">{index + 1}</span>
                  <Avatar name={recruiter.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{recruiter.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {recruiter.stageChanges} pipeline moves · {recruiter.jobsOwned} jobs
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <Link href="/marketing" className="hover:text-brand-700 hover:underline">
                  Campaign Performance
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Link href="/marketing" className="rounded-md p-1 -m-1 hover:bg-muted/60">
                <div className="text-lg font-semibold">{marketing.emailsSent}</div>
                <div className="text-xs text-muted-foreground">Emails sent</div>
              </Link>
              <Link href="/marketing/analytics" className="rounded-md p-1 -m-1 hover:bg-muted/60">
                <div className="text-lg font-semibold">{marketing.openRate}%</div>
                <div className="text-xs text-muted-foreground">Open rate</div>
              </Link>
              <Link href="/marketing/analytics" className="rounded-md p-1 -m-1 hover:bg-muted/60">
                <div className="text-lg font-semibold">{marketing.clickRate}%</div>
                <div className="text-xs text-muted-foreground">Click rate</div>
              </Link>
              <Link href="/marketing/opt-out" className="rounded-md p-1 -m-1 hover:bg-muted/60">
                <div className="text-lg font-semibold">{marketing.unsubscribes}</div>
                <div className="text-xs text-muted-foreground">Opt-outs</div>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Recent Job Activity</CardTitle>
              <Link href="/jobs/activity" className="text-xs text-[#2563eb] hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobActivities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent job activity</p>
              ) : (
                jobActivities.map((item) => (
                  <Link key={item.id} href={`/jobs/${item.jobId}`} className="block rounded-md px-1 -mx-1 py-1 text-sm hover:bg-muted/60">
                    <div className="font-medium">{item.action}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          <ActivityFeed activities={activities} />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                <Link href="/matching" className="hover:text-brand-700 hover:underline">
                  Tasks Due
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/matching?tab=follow-up" className="flex items-start gap-2 rounded-md px-1 -mx-1 py-1 text-sm hover:bg-muted/60">
                <input type="checkbox" className="mt-1 pointer-events-none" tabIndex={-1} readOnly />
                <div>
                  <div>Follow up with candidates</div>
                  <div className="text-xs text-muted-foreground">{taskCounts.followUpCandidates} pending · Today</div>
                </div>
              </Link>
              <Link href="/candidates/inbox" className="flex items-start gap-2 rounded-md px-1 -mx-1 py-1 text-sm hover:bg-muted/60">
                <input type="checkbox" className="mt-1 pointer-events-none" tabIndex={-1} readOnly />
                <div>
                  <div>Review resume inbox</div>
                  <div className="text-xs text-muted-foreground">{taskCounts.resumeInboxCount} items · Today</div>
                </div>
              </Link>
              <Link href="/jobs" className="flex items-start gap-2 rounded-md px-1 -mx-1 py-1 text-sm hover:bg-muted/60">
                <input type="checkbox" className="mt-1 pointer-events-none" tabIndex={-1} readOnly />
                <div>
                  <div>Jobs expiring soon</div>
                  <div className="text-xs text-muted-foreground">{taskCounts.expiringJobs} jobs · Tomorrow</div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  });
}
