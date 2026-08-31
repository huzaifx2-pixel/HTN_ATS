import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listRecycleBin } from "@/lib/services/candidate-service";
import { PageHeader, EmptyState } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { restoreCandidateAction } from "@/app/actions";

export default async function RecycleBinPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const deleted = await listRecycleBin(member.organizationId);

  return (
    <div>
      <PageHeader title="Recycle Bin" description={`${deleted.length} deleted candidates`} />
      <Card>
        <CardContent className="pt-6">
          {deleted.length === 0 ? (
            <EmptyState title="Recycle bin is empty" description="Deleted candidates will appear here" />
          ) : (
            <div className="divide-y">
              {deleted.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
                    {c.deletedAt && (
                      <p className="text-xs text-muted-foreground">
                        Deleted {new Date(c.deletedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <form action={restoreCandidateAction.bind(null, c.id)}>
                    <button type="submit" className="text-xs text-brand-700 hover:underline font-medium">
                      Restore
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
