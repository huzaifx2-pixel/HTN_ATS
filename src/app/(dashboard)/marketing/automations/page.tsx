import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listMarketingAutomations } from "@/lib/services/marketing-brand-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTOMATION_TRIGGER_LABELS } from "@/lib/marketing/types";

export default async function MarketingAutomationsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const automations = await listMarketingAutomations(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader title="Automations" description="Visual nurture workflows triggered by candidate events" />

      <Card>
        <CardHeader><CardTitle className="text-sm">Example Workflow</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-1">Candidate Added</span>
            <span>→</span>
            <span className="rounded-md bg-muted px-2 py-1">Welcome Email</span>
            <span>→</span>
            <span className="rounded-md bg-muted px-2 py-1">Wait 3 days</span>
            <span>→</span>
            <span className="rounded-md bg-muted px-2 py-1">Job Recommendations</span>
            <span>→</span>
            <span className="rounded-md bg-muted px-2 py-1">Recruiter Follow-up</span>
          </div>
          <p className="mt-3">Visual workflow builder with drag-and-drop is scaffolded. Create automations below to store workflow JSON.</p>
        </CardContent>
      </Card>

      {automations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No automations configured yet. Automations will run when triggers fire (candidate created, application submitted, etc.).</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {automations.map((a) => (
            <Card key={a.id}>
              <CardHeader><CardTitle className="text-sm">{a.name}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Trigger: {AUTOMATION_TRIGGER_LABELS[a.trigger]}</p>
                <p>Status: {a.isActive ? "Active" : "Paused"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link href="/marketing/campaigns/new" className="text-sm text-brand-700 hover:underline">Create a manual campaign instead →</Link>
    </div>
  );
}
