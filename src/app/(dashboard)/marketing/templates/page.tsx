import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listMarketingTemplates } from "@/lib/services/marketing-brand-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/marketing/types";

export default async function MarketingTemplatesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const templates = await listMarketingTemplates(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader title="Template Library" description="Prebuilt and custom email templates" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Card key={tpl.id}>
            <CardHeader>
              <CardTitle className="text-sm">{tpl.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{TEMPLATE_CATEGORY_LABELS[tpl.category]}</p>
              <p className="line-clamp-2">{tpl.subject}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/marketing/campaigns/new?template=${tpl.id}`} className="text-brand-700 hover:underline">
                  Use in campaign →
                </Link>
                <Link href={`/marketing/designer?template=${tpl.id}`} className="text-brand-700 hover:underline">
                  Edit in designer →
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
