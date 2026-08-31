import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listMarketingCampaigns } from "@/lib/services/marketing-campaign-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/marketing/types";

export default async function MarketingCampaignsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const campaigns = await listMarketingCampaigns(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Create, schedule, and track email campaigns"
        actions={
          <Button asChild>
            <Link href="/marketing/campaigns/new">New Campaign</Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Open</th>
              <th className="px-4 py-3">Click</th>
              <th className="px-4 py-3">Sent</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No campaigns yet.</td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/marketing/campaigns/${c.id}`} className="font-medium hover:text-brand-700">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3">{CAMPAIGN_TYPE_LABELS[c.type]}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3">{c.audienceSize}</td>
                  <td className="px-4 py-3">{c.openRate}%</td>
                  <td className="px-4 py-3">{c.clickRate}%</td>
                  <td className="px-4 py-3">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
