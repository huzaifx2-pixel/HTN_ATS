import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listOpportunities } from "@/lib/services/crm-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

export default async function OpportunitiesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const opportunities = await listOpportunities(member.organizationId);
  const byStage = STAGES.map((stage) => ({
    stage,
    items: opportunities.filter((item) => item.stage === stage),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Opportunity Pipeline" description="Lead → Qualified → Proposal → Negotiation → Won/Lost" />
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {byStage.map((column) => (
          <Card key={column.stage}>
            <CardContent className="pt-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">{column.stage}</div>
              <div className="space-y-2">
                {column.items.map((opp) => (
                  <div key={opp.id} className="rounded border p-2 text-xs">
                    <div className="font-medium">{opp.name}</div>
                    <Link href={`/admin/clients/${opp.client.id}`} className="text-brand-700 hover:underline">
                      {opp.client.name}
                    </Link>
                    {opp.value ? <div className="text-muted-foreground">${Number(opp.value).toLocaleString()}</div> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
