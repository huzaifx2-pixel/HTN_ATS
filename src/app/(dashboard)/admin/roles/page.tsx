import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { isSuperadminRole } from "@/lib/auth/features";
import { getOrganizationRoleMatrix } from "@/lib/services/role-feature-service";
import { RolesPermissionsMatrix } from "@/components/admin/roles-permissions-matrix";

export default async function RolesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");
  if (!isSuperadminRole(member.role)) redirect("/dashboard");

  const matrix = await getOrganizationRoleMatrix(member.organizationId);

  return (
    <RolesPermissionsMatrix
      initialGrants={matrix.grants}
      lastUpdated={matrix.lastUpdated?.toISOString() ?? null}
    />
  );
}
