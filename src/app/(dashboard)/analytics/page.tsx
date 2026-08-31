import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import {
  getMatchingAnalytics,
  getOrgEmailAnalytics,
  getRecruiterProductivity,
  getSourceAnalytics,
} from "@/lib/services/analytics-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const orgId = member.organizationId;
  const [sources, email, matching, recruiters] = await Promise.all([
    getSourceAnalytics(orgId),
    getOrgEmailAnalytics(orgId),
    getMatchingAnalytics(orgId),
    getRecruiterProductivity(orgId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Recruitment performance across sources, matching, and email outreach"
      />

      <div className="flex gap-2 text-sm">
        <Link href="/analytics" className="font-medium text-brand-700">Overview</Link>
        <Link href="/analytics/parser" className="text-muted-foreground hover:text-brand-700">Parser</Link>
        <Link href="/analytics/recruiters" className="text-muted-foreground hover:text-brand-700">Recruiters</Link>
        <Link href="/analytics/email" className="text-muted-foreground hover:text-brand-700">Email</Link>
        <Link href="/analytics/sources" className="text-muted-foreground hover:text-brand-700">Sources</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Emails Sent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{email.totalSent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Emails Today</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{email.sentToday}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Open Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{email.openRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Auto-sent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{email.autoSent}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Matching</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total matches</span><span>{matching.totalMatches}</span></div>
            <div className="flex justify-between"><span>High matches (70+)</span><span>{matching.highMatches}</span></div>
            <div className="flex justify-between"><span>Average score</span><span>{matching.averageScore}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Candidate Sources</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sources.length === 0 ? (
              <p className="text-muted-foreground">No candidates yet</p>
            ) : (
              sources.map((row) => (
                <div key={row.source} className="flex justify-between">
                  <span>{row.source}</span>
                  <span>{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recruiter Productivity</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recruiters.map((r) => (
            <div key={r.id} className="flex justify-between gap-4">
              <span>{r.name} <span className="text-muted-foreground">({r.role})</span></span>
              <span>{r.jobsOwned} jobs · {r.stageChanges} stage changes</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
