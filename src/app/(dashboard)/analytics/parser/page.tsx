import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getParserAnalytics } from "@/lib/services/analytics-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParserAnalyticsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const stats = await getParserAnalytics(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parser analytics"
        description="Resume parse coverage, version mix, OCR usage, and review backlog"
      />
      <div className="flex gap-2 text-sm">
        <Link href="/analytics" className="text-muted-foreground hover:text-brand-700">Overview</Link>
        <Link href="/analytics/parser" className="font-medium text-brand-700">Parser</Link>
        <Link href="/analytics/recruiters" className="text-muted-foreground hover:text-brand-700">Recruiters</Link>
        <Link href="/analytics/email" className="text-muted-foreground hover:text-brand-700">Email</Link>
        <Link href="/analytics/sources" className="text-muted-foreground hover:text-brand-700">Sources</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Parsed resumes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">OCR rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{stats.ocrRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Needs review</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{stats.needsReview}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Missing sections</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{stats.missingSections}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Parser versions</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {stats.byVersion.length === 0 ? (
            <p className="text-muted-foreground">No parsed resumes yet</p>
          ) : (
            stats.byVersion.map((row) => (
              <div key={row.version} className="flex justify-between">
                <span>{row.version}</span>
                <span>{row.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
