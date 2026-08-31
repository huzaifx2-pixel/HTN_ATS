import { redirect } from "next/navigation";
import { getActiveOrganization, getSession, hasPermission } from "@/lib/auth/session";
import { getMarketingSettings } from "@/lib/services/marketing-brand-service";
import { listPendingApprovalCampaigns } from "@/lib/services/marketing-scheduled-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { MarketingSettingsForm } from "@/components/marketing/marketing-settings-form";
import { MarketingApprovalPanel } from "@/components/marketing/marketing-approval-panel";

export default async function MarketingSettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const [settings, pendingApproval] = await Promise.all([
    getMarketingSettings(member.organizationId),
    listPendingApprovalCampaigns(member.organizationId),
  ]);
  const canAdmin = hasPermission(member.role, "admin");

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Settings" description="Sending provider, defaults, compliance, and approvals" />
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
      <MarketingSettingsForm settings={settings} canAdmin={canAdmin} />
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Compliance</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>One-click unsubscribe links are injected automatically</li>
          <li>Suppression list honors GDPR/CAN-SPAM opt-outs</li>
          <li>SPF/DKIM/DMARC: configure via your sending domain DNS (Gmail uses connected account)</li>
          <li>Additional providers (AWS SES, SendGrid, Mailgun, Postmark, Microsoft 365) can be selected below</li>
        </ul>
      </div>
    </div>
  );
}
