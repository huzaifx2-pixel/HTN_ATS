import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getMarketingBrandKit } from "@/lib/services/marketing-brand-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { BrandKitForm } from "@/components/marketing/brand-kit-form";

export default async function BrandKitPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const brand = await getMarketingBrandKit(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader title="Brand Kit" description="Logo, colors, fonts, footer, and signature blocks for all campaigns" />
      <BrandKitForm brand={brand} />
    </div>
  );
}
