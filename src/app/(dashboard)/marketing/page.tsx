import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getMarketingDashboardStats, listMarketingCampaigns } from "@/lib/services/marketing-campaign-service";
import { getMarketingTrendStats, listPendingApprovalCampaigns } from "@/lib/services/marketing-scheduled-service";
import { StatCard } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingTrendChart } from "@/components/marketing/marketing-trend-chart";
import { MarketingApprovalPanel } from "@/components/marketing/marketing-approval-panel";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/marketing/types";
import { Mail, MousePointerClick, Send, Target, TrendingUp, Users, XCircle, Zap } from "lucide-react";

export default async function MarketingDashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const [stats, campaigns, trend, pendingApproval] = await Promise.all([
    getMarketingDashboardStats(member.organizationId),
    listMarketingCampaigns(member.organizationId),
    getMarketingTrendStats(member.organizationId),
    listPendingApprovalCampaigns(member.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button asChild>
          <Link href="/marketing/campaigns/new">Create Campaign</Link>
        </Button>
      </div>

      <MarketingApprovalPanel
        campaigns={pendingApproval.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          updatedAt: campaign.updatedAt.toISOString(),
          audience: campaign.audience
            ? { name: campaign.audience.name, estimatedCount: campaign.audience.estimatedCount }
            : null,
        }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Emails Sent" value={stats.emailsSent} icon={Send} />
        <StatCard label="Delivered" value={stats.delivered} icon={Mail} />
        <StatCard label="Open Rate" value={`${stats.openRate}%`} icon={TrendingUp} />
        <StatCard label="Click Rate" value={`${stats.clickRate}%`} icon={MousePointerClick} />
        <StatCard label="Applications" value={stats.applicationsGenerated} icon={Target} />
        <StatCard label="Unsubscribes" value={stats.unsubscribes} icon={XCircle} />
        <StatCard label="Bounce Rate" value={`${stats.bounceRate}%`} icon={Mail} />
        <StatCard label="Active Campaigns" value={stats.activeCampaigns} icon={Zap} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Daily performance (30 days)</CardTitle></CardHeader>
          <CardContent>
            <MarketingTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Conversion Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Sent</span><span>{stats.emailsSent}</span></div>
            <div className="flex justify-between"><span>Delivered</span><span>{stats.delivered}</span></div>
            <div className="flex justify-between"><span>Opened</span><span>{Math.round(stats.emailsSent * stats.openRate / 100)}</span></div>
            <div className="flex justify-between"><span>Clicked</span><span>{Math.round(stats.emailsSent * stats.clickRate / 100)}</span></div>
            <div className="flex justify-between font-medium"><span>Applied</span><span>{stats.applicationsGenerated}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Campaigns</CardTitle>
          <Link href="/marketing/campaigns" className="text-xs text-brand-700 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet. Create your first campaign to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Campaign</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Audience</th>
                    <th className="py-2 pr-4">Open</th>
                    <th className="py-2">Click</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 8).map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <Link href={`/marketing/campaigns/${c.id}`} className="font-medium hover:text-brand-700">{c.name}</Link>
                      </td>
                      <td className="py-2 pr-4">{CAMPAIGN_TYPE_LABELS[c.type]}</td>
                      <td className="py-2 pr-4">{c.status}</td>
                      <td className="py-2 pr-4">{c.audienceSize}</td>
                      <td className="py-2 pr-4">{c.openRate}%</td>
                      <td className="py-2">{c.clickRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
