import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getMarketingDashboardStats, listMarketingCampaigns } from "@/lib/services/marketing-campaign-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/dashboard-widgets";
import { Mail, MousePointerClick, Send, Target, TrendingUp } from "lucide-react";

export default async function MarketingAnalyticsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const [stats, campaigns] = await Promise.all([
    getMarketingDashboardStats(member.organizationId),
    listMarketingCampaigns(member.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Analytics" description="Campaign performance, funnel metrics, and ROI" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Sent" value={stats.emailsSent} icon={Send} />
        <StatCard label="Delivered" value={stats.delivered} icon={Mail} />
        <StatCard label="Open Rate" value={`${stats.openRate}%`} icon={TrendingUp} />
        <StatCard label="Click Rate" value={`${stats.clickRate}%`} icon={MousePointerClick} />
        <StatCard label="Applications" value={stats.applicationsGenerated} icon={Target} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Campaign Performance</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Campaign</th>
                <th className="py-2">Sent</th>
                <th className="py-2">Open</th>
                <th className="py-2">Click</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">{c.sentAt ? "Yes" : "—"}</td>
                  <td className="py-2">{c.openRate}%</td>
                  <td className="py-2">{c.clickRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
