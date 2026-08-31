import { Suspense } from "react";
import { getDashboardData, getRecentActivity, getRecruiterProductivity } from "@/lib/services/analytics-service";
import { getMarketingDashboardStats } from "@/lib/services/marketing-campaign-service";
import { getTopOpenJobs } from "@/lib/services/job-service";
import { getCandidatesAddedThisWeek } from "@/lib/services/candidate-service";
import {
  attachJobMatchEmailStats,
  countJobsWithPendingMatchEmails,
  getJobsWithPendingMatchEmails,
} from "@/lib/services/match-email-outreach-service";
import { StatCard, TaskCard, LoadingSkeleton } from "@/components/shared/dashboard-widgets";
import { withPagePerf } from "@/lib/perf";
import { PipelineFunnel, ActivityFeed } from "@/components/shared/pipeline-funnel";
import { CompactJobTable, CandidateListItem } from "@/components/shared/job-table";
import { PendingMatchEmailTable } from "@/components/shared/pending-match-email-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Briefcase, Users, Target, Trophy, Mail, Calendar,
} from "lucide-react";

export async function DashboardMetrics({ organizationId }: { organizationId: string }) {
  return withPagePerf("dashboard", async () => {
    const { stats } = await getDashboardData(organizationId);
    return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Open Jobs" value={stats.openJobs} icon={Briefcase} href="/jobs" />
        <StatCard label="Active Candidates" value={stats.activeCandidates} icon={Users} href="/candidates" />
        <StatCard label="Matched Today" value={stats.matchedToday} icon={Target} href="/analytics" />
        <StatCard label="Resumes Today" value={stats.resumesImportedToday} icon={Briefcase} href="/candidates/inbox" />
        <StatCard label="Emails Today" value={stats.emailsSentToday} icon={Mail} href="/analytics/email" />
        <StatCard label="Placements" value={stats.placements} icon={Trophy} href="/analytics" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Jobs" value={stats.totalJobs} icon={Briefcase} href="/jobs" />
        <StatCard label="Candidates Matched" value={stats.candidatesMatched} icon={Target} href="/analytics" />
        <StatCard label="Pending Inbox" value={stats.pendingInbox} icon={Mail} href="/candidates/inbox" />
        <StatCard label="Email Failures Today" value={stats.emailsFailedToday} icon={Calendar} href="/analytics/email" />
      </div>
    </>
    );
  });
}

export async function DashboardTasks({ organizationId }: { organizationId: string }) {
  return withPagePerf("dashboard.tasks", async () => {
    const [{ taskCounts, workers }, activities, pendingEmailCount] = await Promise.all([
      getDashboardData(organizationId),
      getRecentActivity(organizationId),
      countJobsWithPendingMatchEmails(organizationId),
    ]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold mb-3">My Tasks</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TaskCard label="Follow up with Candidates" count={taskCounts.followUpCandidates} href="/candidates" />
            <TaskCard label="Interviews completed" count={taskCounts.upcomingInterviews} href="/jobs" />
            <TaskCard label="Gmail Imports" count={taskCounts.resumeInboxCount} href="/candidates/inbox" />
            <TaskCard label="Jobs Expiring Soon" count={taskCounts.expiringJobs} href="/jobs" />
            <TaskCard
              label="Pending Match Email"
              count={pendingEmailCount}
              href="/dashboard?tab=pending-email"
            />
          </div>
        </div>
        <ActivityFeed activities={activities} />
      </div>

      {workers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Background Workers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workers.map((worker) => (
              <div key={worker.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{worker.name}</span>
                <span className="text-muted-foreground">
                  {worker.running
                    ? "Running"
                    : worker.lastError
                      ? `Error: ${worker.lastError}`
                      : worker.lastSuccessAt
                        ? `OK · ${new Date(worker.lastSuccessAt).toLocaleString()}`
                        : "Idle"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
    );
  });
}

export async function DashboardLists({ organizationId }: { organizationId: string }) {
  return withPagePerf("dashboard.lists", async () => {
    const [{ pipeline }, topJobs, recentCandidates] = await Promise.all([
      getDashboardData(organizationId),
      getTopOpenJobs(organizationId),
      getCandidatesAddedThisWeek(organizationId),
    ]);
    const topJobsWithEmailStats = await attachJobMatchEmailStats(organizationId, topJobs);

  return (
    <>
      <PipelineFunnel data={pipeline} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CompactJobTable jobs={topJobsWithEmailStats} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Candidates Added This Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No candidates added this week</p>
            ) : (
              recentCandidates.map((c) => <CandidateListItem key={c.id} candidate={c} />)
            )}
          </CardContent>
        </Card>
      </div>
    </>
    );
  });
}

export async function PendingEmailCount({ organizationId }: { organizationId: string }) {
  const count = await countJobsWithPendingMatchEmails(organizationId);
  return <>Pending Match Email ({count})</>;
}

export async function PendingEmailPanel({ organizationId }: { organizationId: string }) {
  const jobs = await getJobsWithPendingMatchEmails(organizationId, 50);
  return <PendingMatchEmailTable jobs={jobs} />;
}

export function WidgetFallback({ height = "h-24" }: { height?: string }) {
  return <LoadingSkeleton className={`w-full ${height}`} />;
}

export async function DashboardLeaderboard({ organizationId }: { organizationId: string }) {
  return withPagePerf("dashboard.leaderboard", async () => {
    const [recruiters, marketing] = await Promise.all([
      getRecruiterProductivity(organizationId),
      getMarketingDashboardStats(organizationId),
    ]);

    const topRecruiters = [...recruiters]
      .sort((a, b) => b.stageChanges - a.stageChanges || b.jobsOwned - a.jobsOwned)
      .slice(0, 5);

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recruiter Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topRecruiters.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recruiter activity yet.</p>
            ) : (
              topRecruiters.map((recruiter, index) => (
                <div key={recruiter.id} className="flex items-center justify-between text-sm">
                  <span>
                    {index + 1}. {recruiter.name}
                    <span className="text-muted-foreground ml-2 text-xs">{recruiter.role}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {recruiter.stageChanges} moves · {recruiter.jobsOwned} jobs
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Marketing Rollup</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-2xl font-semibold">{marketing.emailsSent}</div><div className="text-xs text-muted-foreground">Emails sent</div></div>
            <div><div className="text-2xl font-semibold">{marketing.openRate}%</div><div className="text-xs text-muted-foreground">Open rate</div></div>
            <div><div className="text-2xl font-semibold">{marketing.clickRate}%</div><div className="text-xs text-muted-foreground">Click rate</div></div>
            <div><div className="text-2xl font-semibold">{marketing.unsubscribes}</div><div className="text-xs text-muted-foreground">Opt-outs</div></div>
          </CardContent>
        </Card>
      </div>
    );
  });
}

export function DashboardOverview({ organizationId }: { organizationId: string }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetFallback height="h-32" />}>
        <DashboardMetrics organizationId={organizationId} />
      </Suspense>
      <Suspense fallback={<WidgetFallback height="h-48" />}>
        <DashboardTasks organizationId={organizationId} />
      </Suspense>
      <Suspense fallback={<WidgetFallback height="h-40" />}>
        <DashboardLeaderboard organizationId={organizationId} />
      </Suspense>
      <Suspense fallback={<WidgetFallback height="h-64" />}>
        <DashboardLists organizationId={organizationId} />
      </Suspense>
    </div>
  );
}
