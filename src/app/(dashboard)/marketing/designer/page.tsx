import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { EmailDesignerWorkspace } from "@/components/marketing/email-designer-workspace";
import {
  getMarketingBrandKit,
  getMarketingTemplate,
  listMarketingTemplates,
} from "@/lib/services/marketing-brand-service";
import type { EmailBlock } from "@/lib/marketing/types";

export default async function EmailDesignerPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { template: templateId } = await searchParams;
  const [brand, templates, initialTemplate] = await Promise.all([
    getMarketingBrandKit(member.organizationId),
    listMarketingTemplates(member.organizationId),
    templateId ? getMarketingTemplate(member.organizationId, templateId) : Promise.resolve(null),
  ]);

  const templateOptions = templates.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    subject: tpl.subject,
    designJson: tpl.designJson as EmailBlock[],
    isSystem: tpl.isSystem,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Designer"
        description="Design emails, save templates, and send test messages"
      />
      <EmailDesignerWorkspace
        brand={brand}
        templates={templateOptions}
        initialTemplate={
          initialTemplate
            ? {
                id: initialTemplate.id,
                name: initialTemplate.name,
                subject: initialTemplate.subject,
                designJson: initialTemplate.designJson as EmailBlock[],
                isSystem: initialTemplate.isSystem,
              }
            : null
        }
      />
    </div>
  );
}
