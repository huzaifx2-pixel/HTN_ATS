import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getSourceAnalytics } from "@/lib/services/analytics-service";
import { getResumeImportStats } from "@/lib/services/resume-import-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCandidateSource } from "@/lib/services/candidate-service";
import type { CandidateSource } from "@prisma/client";

export default async function SourceAnalyticsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const orgId = member.organizationId;
  const [sources, importStats] = await Promise.all([
    getSourceAnalytics(orgId),
    getResumeImportStats(orgId),
  ]);

  const total = sources.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Source Analytics" description="Where candidates and resumes enter the system" />
      <div className="flex gap-2 text-sm">
        <Link href="/analytics" className="text-muted-foreground hover:text-brand-700">Overview</Link>
        <Link href="/analytics/recruiters" className="text-muted-foreground hover:text-brand-700">Recruiters</Link>
        <Link href="/analytics/email" className="text-muted-foreground hover:text-brand-700">Email</Link>
        <Link href="/analytics/sources" className="font-medium text-brand-700">Sources</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Imports Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{importStats.todayCount}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Import Failures Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{importStats.failed}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Duplicates Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{importStats.duplicates}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total Import Logs</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{importStats.total}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Candidates by Source</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {sources.map((row) => (
            <div key={row.source}>
              <div className="flex justify-between text-sm mb-1">
                <span>{formatCandidateSource(row.source as CandidateSource)}</span>
                <span>{row.count} ({total ? Math.round((row.count / total) * 100) : 0}%)</span>
              </div>
              <div className="h-2 rounded bg-muted">
                <div
                  className="h-2 rounded bg-brand-700"
                  style={{ width: `${total ? (row.count / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
