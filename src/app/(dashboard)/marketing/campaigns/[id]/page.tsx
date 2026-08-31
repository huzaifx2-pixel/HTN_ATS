import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getMarketingCampaign } from "@/lib/services/marketing-campaign-service";
import { getCampaignAnalytics } from "@/lib/services/marketing-brand-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/marketing/types";
import { SendCampaignButton } from "@/components/marketing/send-campaign-button";
import { after } from "next/server";
import { timeAsync, trackRequestDuration, withPagePerf } from "@/lib/perf";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  after(trackRequestDuration("campaign-detail"));

  const { campaign, analytics } = await withPagePerf("campaign-detail", async () => {
    const session = await timeAsync("campaign-detail.auth", () => getSession());
    if (!session?.user) redirect("/login");
    const member = await timeAsync("campaign-detail.org", () => getActiveOrganization(session.user.id));
    if (!member) redirect("/signup");

    const loaded = await timeAsync("campaign-detail.getMarketingCampaign", () =>
      getMarketingCampaign(member.organizationId, id),
    );
    if (!loaded) return { campaign: null, analytics: null };
    const stats = await timeAsync("campaign-detail.getCampaignAnalytics", () =>
      getCampaignAnalytics(member.organizationId, id),
    );
    return { campaign: loaded, analytics: stats };
  });
  if (!campaign) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={`${CAMPAIGN_TYPE_LABELS[campaign.type]} · ${campaign.status}`}
        actions={campaign.status === "DRAFT" || campaign.status === "SCHEDULED" ? <SendCampaignButton campaignId={campaign.id} /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Recipients</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{analytics?.funnel.recipients ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Sent</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{analytics?.funnel.sent ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Open Rate</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{analytics?.rates.openRate ?? 0}%</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Click Rate</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{analytics?.rates.clickRate ?? 0}%</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Conversion Funnel</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4 text-sm">
          <div>Sent → {analytics?.funnel.sent ?? 0}</div>
          <div>Delivered → {analytics?.funnel.delivered ?? 0}</div>
          <div>Opened → {analytics?.funnel.opened ?? 0}</div>
          <div>Clicked → {analytics?.funnel.clicked ?? 0}</div>
          <div>Applied → {analytics?.funnel.applied ?? 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Campaign Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Subject:</strong> {campaign.subject ?? "—"}</p>
          <p><strong>Audience:</strong> {campaign.audience?.name ?? "Manual selection"}</p>
          <p><strong>Schedule:</strong> {campaign.scheduleType}{campaign.scheduledAt ? ` · ${new Date(campaign.scheduledAt).toLocaleString()}` : ""}</p>
          {campaign.internalNotes && <p><strong>Notes:</strong> {campaign.internalNotes}</p>}
          <Link href="/marketing/analytics" className="text-brand-700 hover:underline">View full analytics →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
