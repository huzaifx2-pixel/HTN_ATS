import { redirect } from "next/navigation";
import { getActiveOrganization, getSession, hasPermission } from "@/lib/auth/session";
import { getRoleFeatures } from "@/lib/services/role-feature-service";
import { getOrgStorageSettings } from "@/lib/services/org-settings-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { StorageLimitForm } from "@/components/settings/storage-limit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const storage = await getOrgStorageSettings(member.organizationId);
  const features = await getRoleFeatures(member.organizationId, member.role);
  const canManage = hasPermission(member.role, "admin", features);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Organization and application settings" />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-sm">Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Resume uploads, Gmail imports, and other documents count toward this limit. The footer
            bar shows the same usage.
          </p>
          <StorageLimitForm {...storage} canManage={canManage} />
        </CardContent>
      </Card>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-sm">Organization</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Configure job ID rules, default templates, matching weights, and feature flags.</p>
          <p className="text-muted-foreground">Visit Admin → Clients to manage job ID prefixes.</p>
        </CardContent>
      </Card>
    </div>
  );
}
