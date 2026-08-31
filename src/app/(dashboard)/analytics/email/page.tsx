import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getOrgEmailAnalytics } from "@/lib/services/analytics-service";
import { getEmailQueueStats } from "@/lib/services/email-retry-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EmailAnalyticsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const orgId = member.organizationId;
  const [email, queue] = await Promise.all([
    getOrgEmailAnalytics(orgId),
    getEmailQueueStats(orgId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Email Analytics" description="Outreach performance and retry queue status" />
      <div className="flex gap-2 text-sm">
        <Link href="/analytics" className="text-muted-foreground hover:text-brand-700">Overview</Link>
        <Link href="/analytics/recruiters" className="text-muted-foreground hover:text-brand-700">Recruiters</Link>
        <Link href="/analytics/email" className="font-medium text-brand-700">Email</Link>
        <Link href="/analytics/sources" className="text-muted-foreground hover:text-brand-700">Sources</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Total Sent</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{email.totalSent}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Sent Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{email.sentToday}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Opened</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{email.opened}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Clicked</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{email.clicked}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Retry Queue</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
          <div>Pending: {queue.pending}</div>
          <div>Failed: {queue.failed}</div>
          <div>Completed retries: {queue.sent}</div>
        </CardContent>
      </Card>
    </div>
  );
}
