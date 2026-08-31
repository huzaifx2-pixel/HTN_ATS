import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listAudiences } from "@/lib/services/marketing-audience-service";
import { listMarketingSuppressions } from "@/lib/services/marketing-unsubscribe-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { AudienceTabs } from "@/components/marketing/audience-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { after } from "next/server";
import { timeAsync, trackRequestDuration, withPagePerf } from "@/lib/perf";

export default async function MarketingAudiencesPage() {
  after(trackRequestDuration("audiences"));

  const { audiences, unsubscribed } = await withPagePerf("audiences", async () => {
    const session = await timeAsync("audiences.auth", () => getSession());
    if (!session?.user) redirect("/login");
    const member = await timeAsync("audiences.org", () => getActiveOrganization(session.user.id));
    if (!member) redirect("/signup");

    const saved = await timeAsync("audiences.listAudiences", () => listAudiences(member.organizationId));
    const suppressed = await timeAsync("audiences.listMarketingSuppressions", () =>
      listMarketingSuppressions(member.organizationId),
    );
    return { audiences: saved, unsubscribed: suppressed };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audiences" description="Build segments from ATS data, import contacts, or manage unsubscribes" />
      <AudienceTabs
        unsubscribed={unsubscribed.map((entry) => ({
          id: entry.id,
          email: entry.email,
          createdAt: entry.createdAt.toISOString(),
          candidate: entry.candidate,
        }))}
      />
      <Card>
        <CardHeader><CardTitle className="text-sm">Saved Audiences</CardTitle></CardHeader>
        <CardContent>
          {audiences.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved audiences yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {audiences.map((a) => {
                const filters = a.filters as { sourceType?: string };
                const isImport = filters?.sourceType === "import";
                return (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="font-medium">
                      {a.name}
                      {isImport && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          Imported
                        </span>
                      )}
                    </p>
                    {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                  </div>
                  <span className="text-muted-foreground">{a.estimatedCount} recipients</span>
                </li>
              )})}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
