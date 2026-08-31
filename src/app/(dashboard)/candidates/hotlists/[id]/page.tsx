import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getHotlist } from "@/lib/services/hotlist-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterCandidateNav } from "@/components/candidates/register-candidate-nav";

export default async function HotlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const hotlist = await getHotlist(id, member.organizationId);
  if (!hotlist) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={hotlist.name}
        description={hotlist.description ?? `${hotlist.members.length} candidates`}
        actions={
          <Link href="/candidates/hotlists" className="text-sm text-brand-700 hover:underline">
            Back to hotlists
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-6 space-y-2">
          {hotlist.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add candidates from Talent Search or the database using bulk actions.</p>
          ) : (
            <>
            <RegisterCandidateNav
              ids={hotlist.members.map((memberRow) => memberRow.candidate.id)}
              returnTo={`/candidates/hotlists/${id}`}
            />
            {hotlist.members.map((memberRow) => (
              <Link
                key={memberRow.candidateId}
                href={`/candidates/${memberRow.candidate.id}`}
                className="block rounded-lg border px-3 py-2 hover:bg-muted/40"
              >
                <div className="text-sm font-medium">
                  {memberRow.candidate.firstName} {memberRow.candidate.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[memberRow.candidate.currentRole, memberRow.candidate.currentCompany, memberRow.candidate.email]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
            ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
