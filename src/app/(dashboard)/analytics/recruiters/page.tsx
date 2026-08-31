import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getRecruiterProductivity } from "@/lib/services/analytics-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RecruiterAnalyticsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const recruiters = await getRecruiterProductivity(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader title="Recruiter Analytics" description="Jobs owned and pipeline activity by recruiter" />
      <div className="flex gap-2 text-sm">
        <Link href="/analytics" className="text-muted-foreground hover:text-brand-700">Overview</Link>
        <Link href="/analytics/recruiters" className="font-medium text-brand-700">Recruiters</Link>
        <Link href="/analytics/email" className="text-muted-foreground hover:text-brand-700">Email</Link>
        <Link href="/analytics/sources" className="text-muted-foreground hover:text-brand-700">Sources</Link>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Team Performance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {recruiters.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.role}</div>
              </div>
              <div className="text-sm text-right">
                <div>{r.jobsOwned} jobs owned</div>
                <div className="text-muted-foreground">{r.stageChanges} pipeline moves</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
