import { redirect } from "next/navigation";

import { getActiveOrganization, getSession } from "@/lib/auth/session";

import { getOrgMembers } from "@/lib/services/analytics-service";

import { isSuperAdminEmail } from "@/lib/org/super-admin";

import { PageHeader } from "@/components/shared/dashboard-widgets";

import { UserManagementPanel } from "@/components/admin/user-management-panel";



export default async function AdminUsersPage() {

  const session = await getSession();

  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);

  if (!member) redirect("/signup");



  const members = await getOrgMembers(member.organizationId);

  const canManage = isSuperAdminEmail(session.user.email);



  return (

    <div>

      <PageHeader

        title="Users"

        description={

          canManage

            ? "Add or remove team members, change roles, edit names, and reset passwords"

            : "View organization members"

        }

      />

      <UserManagementPanel

        members={members}

        currentUserId={session.user.id}

        canManage={canManage}

      />

    </div>

  );

}


