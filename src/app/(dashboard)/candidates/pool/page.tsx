import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listEngagedCandidates } from "@/lib/services/candidate-service";
import { PageHeader, EmptyState } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RegisterCandidateNav } from "@/components/candidates/register-candidate-nav";

export default async function TalentPoolPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { items } = await listEngagedCandidates(member.organizationId, { limit: 100 });

  return (
    <div>
      <PageHeader
        title="Talent Pool"
        description={`${items.length} engaged candidates`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/candidates">View Candidate Database</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {items.length === 0 ? (
            <EmptyState
              title="No engaged candidates yet"
              description="Engaged candidates appear here after you email them, add them to a job, or mark them engaged. All imports live in Candidate Database."
            />
          ) : (
            <div className="divide-y">
              <RegisterCandidateNav ids={items.map((c) => c.id)} returnTo="/candidates/pool" />
              {items.map((c) => (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  className="flex items-center justify-between py-3 hover:text-brand-700"
                >
                  <div>
                    <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
                    {c.applications[0] && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {c.applications[0].job.jobCode} · {c.applications[0].job.title}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{c.currentRole ?? c.email ?? "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
