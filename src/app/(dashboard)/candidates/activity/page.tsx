import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getCandidateActivityFeed } from "@/lib/activity/queries";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { ActivityTable } from "@/components/shared/activity-table";

export default async function CandidateActivityPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const activities = await getCandidateActivityFeed(member.organizationId, 50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Activity"
        description="Candidate changes only — resumes, pipeline moves, and recruiter outreach."
      />
      <ActivityTable
        activities={activities}
        title="Candidate activity stream"
        emptyMessage="No candidate activity yet."
      />
    </div>
  );
}
