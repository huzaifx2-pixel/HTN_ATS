import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listMarketingSuppressions } from "@/lib/services/marketing-unsubscribe-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { formatJobTimestamp } from "@/lib/utils";

export default async function OptOutCenterPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const suppressions = await listMarketingSuppressions(member.organizationId, 500);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opt-Out Center"
        description="Global suppression list — candidates and contacts who unsubscribed or were marked do-not-contact."
        actions={
          <Link href="/marketing/audiences" className="text-sm text-brand-700 hover:underline">
            Audiences
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {suppressions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppressed contacts yet.</p>
          ) : (
            <div className="space-y-2">
              {suppressions.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{entry.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.reason ?? "suppressed"}
                      {entry.candidate ? (
                        <>
                          {" · "}
                          <Link href={`/candidates/${entry.candidate.id}`} className="text-brand-700 hover:underline">
                            {entry.candidate.name}
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatJobTimestamp(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
