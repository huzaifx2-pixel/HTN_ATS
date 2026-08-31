import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getJobActivityFeed } from "@/lib/activity/queries";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { ActivityTable } from "@/components/shared/activity-table";

export default async function JobActivityPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const activities = await getJobActivityFeed(member.organizationId, 50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Activity"
        description="Job changes only — created, updated, published, closed, and sync events."
      />
      <ActivityTable
        activities={activities}
        title="Job activity stream"
        emptyMessage="No job activity yet. Create or update a job to see events here."
      />
    </div>
  );
}
