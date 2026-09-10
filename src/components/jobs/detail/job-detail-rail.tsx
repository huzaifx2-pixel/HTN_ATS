import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { formatActivityAction } from "@/lib/activity/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobMarketIntelligence } from "@/lib/services/job-market-service";

export function JobDetailRail({
  jobId,
  healthScore,
  analytics,
  insights,
  market,
  activities,
}: {
  jobId: string;
  healthScore: number;
  analytics: {
    totalApplicants: number;
    submissions: number;
    interviews: number;
    timeOpenDays: number;
    submissionRate: number;
  };
  insights: string[];
  market: JobMarketIntelligence | null;
  activities: Array<{
    id: string;
    action: string;
    metadata: unknown;
    createdAt: Date;
    actor?: { name: string } | null;
  }>;
}) {
  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Job Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-2xl font-semibold">{healthScore}/100</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${healthScore}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Applicants</dt>
              <dd className="font-medium">{analytics.totalApplicants}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Qualified</dt>
              <dd className="font-medium">{analytics.submissions}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Interviews</dt>
              <dd className="font-medium">{analytics.interviews}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time Open</dt>
              <dd className="font-medium">{analytics.timeOpenDays}d</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Submission Rate</dt>
              <dd className="font-medium">{analytics.submissionRate}%</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AI Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-xs text-muted-foreground">
            {insights.map((insight) => (
              <li key={insight} className="list-disc pl-4">
                {insight}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/jobs/${jobId}?tab=matching`} className="rounded-md border px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">
              Find Candidates
            </Link>
            <Link href={`/jobs/${jobId}?tab=edit`} className="rounded-md border px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">
              Generate Boolean
            </Link>
            <Link href={`/jobs/${jobId}?tab=edit`} className="rounded-md border px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">
              Rewrite JD
            </Link>
            <a href="#market-intel" className="rounded-md border px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">
              Market Analysis
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            activities.slice(0, 6).map((activity) => (
              <div key={activity.id} className="flex gap-2 text-xs">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-700" />
                <div>
                  <div className="font-medium text-foreground">
                    {activity.actor?.name ?? "System"} · {formatActivityAction(activity.action, activity.metadata)}
                  </div>
                  <div className="text-muted-foreground">
                    {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))
          )}
          <Link href={`/jobs/${jobId}?tab=activity`} className="text-xs font-medium text-brand-700 hover:underline">
            View all activity
          </Link>
        </CardContent>
      </Card>

      <Card id="market-intel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Market Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          {!market ? (
            <p className="text-xs text-muted-foreground">Market data unavailable.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Available Candidates</dt>
                <dd className="text-sm font-semibold">{market.availableCandidates.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peer Clients</dt>
                <dd className="text-sm font-semibold">{market.activeCompetitors}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Avg Salary</dt>
                <dd className="text-sm font-semibold">
                  {market.avgSalary != null ? `$${market.avgSalary.toLocaleString()}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hiring Demand</dt>
                <dd className="text-sm font-semibold">{market.hiringDemand}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
