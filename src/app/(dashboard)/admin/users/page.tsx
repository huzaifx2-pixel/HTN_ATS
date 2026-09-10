import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getOrgMembers } from "@/lib/services/analytics-service";
import { isSuperadminRole } from "@/lib/auth/features";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { UserManagementPanel } from "@/components/admin/user-management-panel";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");
  if (!isSuperadminRole(member.role)) redirect("/dashboard");

  const members = await getOrgMembers(member.organizationId);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Add or remove team members, change roles, edit names, and reset passwords"
      />
      <UserManagementPanel
        members={members}
        currentUserId={session.user.id}
        canManage
      />
    </div>
  );
}
