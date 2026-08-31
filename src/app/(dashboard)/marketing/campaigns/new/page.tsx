import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listAudiences } from "@/lib/services/marketing-audience-service";
import { getMarketingBrandKit, getMarketingTemplate } from "@/lib/services/marketing-brand-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { CampaignWizard } from "@/components/marketing/campaign-wizard";
import type { EmailBlock } from "@/lib/marketing/types";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { template: templateId } = await searchParams;
  const [audiences, brand, template] = await Promise.all([
    listAudiences(member.organizationId),
    getMarketingBrandKit(member.organizationId),
    templateId ? getMarketingTemplate(member.organizationId, templateId) : Promise.resolve(null),
  ]);

  const initialBlocks = template?.designJson ? (template.designJson as EmailBlock[]) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Campaign"
        description={template ? `Starting from template: ${template.name}` : "Four-step wizard: info, audience, design, schedule"}
      />
      <CampaignWizard
        audiences={audiences.map((a) => ({
          id: a.id,
          name: a.name,
          estimatedCount: a.estimatedCount,
        }))}
        brand={brand}
        initialBlocks={initialBlocks}
        initialSubject={template?.subject ?? undefined}
      />
    </div>
  );
}
