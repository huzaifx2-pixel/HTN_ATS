import { redirect } from "next/navigation";
import { getSession, getActiveOrganization } from "@/lib/auth/session";
import { getExecutiveDashboardPreviewData } from "@/lib/services/executive-dashboard-preview";
import { ExecutiveDashboardV2 } from "@/components/dashboard/v2/executive-dashboard-v2";

export default async function DashboardPreviewPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const data = await getExecutiveDashboardPreviewData(
    member.organizationId,
    session.user.name,
    session.session?.id ?? session.user.id,
  );

  return <ExecutiveDashboardV2 data={data} />;
}
