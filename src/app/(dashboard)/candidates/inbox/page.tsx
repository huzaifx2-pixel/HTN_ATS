import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import {
  listPendingInboxDrafts,
  getGmailConnection,
} from "@/lib/services/gmail-service";
import { approveDraftAction, approveAllDraftsAction, rejectDraftAction } from "@/app/actions";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GmailSyncButton } from "@/components/candidates/gmail-sync-button";

export default async function ResumeInboxPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const [drafts, gmail] = await Promise.all([
    listPendingInboxDrafts(member.organizationId),
    getGmailConnection(session.user.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Resume Inbox"
        description="New Gmail resumes awaiting review. Approved items move to Candidate Database and won't reappear here."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/candidates">View Candidate Database</Link>
            </Button>
            {drafts.length > 0 && (
              <form action={approveAllDraftsAction}>
                <Button size="sm" type="submit">
                  Approve all ({drafts.length})
                </Button>
              </form>
            )}
            {gmail ? (
              <GmailSyncButton />
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/integrations">Set up Gmail</Link>
              </Button>
            )}
          </div>
        }
      />

      {!gmail && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-800">
            Gmail is not connected. Open{" "}
            <Link href="/admin/integrations" className="underline font-medium">Integrations</Link>
            {" "}and complete the Google OAuth setup (add credentials to <code className="text-xs">.env</code>, then connect).
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Inbox is clear.{" "}
              {gmail
                ? "Sync from Gmail to pull new resume attachments, or check Candidate Database for profiles already imported."
                : "Connect Gmail or upload resumes manually."}
            </CardContent>
          </Card>
        ) : (
          drafts.map((draft) => (
            <Card key={draft.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {draft.firstName ?? "Unknown"} {draft.lastName ?? ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{draft.email ?? "No email"}</p>
                    {draft.fileName && (
                      <p className="text-xs text-muted-foreground mt-1">{draft.fileName}</p>
                    )}
                    {Array.isArray(draft.suggestedJobs) && draft.suggestedJobs.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Suggested jobs
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(draft.suggestedJobs as Array<{ jobCode: string; title: string; score: number; jobId: string }>).slice(0, 3).map((job) => (
                            <Link
                              key={job.jobId}
                              href={`/jobs/${job.jobId}?tab=matching`}
                              className="text-xs rounded bg-muted px-2 py-0.5 hover:text-brand-700"
                            >
                              {job.jobCode} · {job.score}%
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <form action={rejectDraftAction.bind(null, draft.id)}>
                        <Button size="sm" variant="outline" type="submit">
                          Reject
                        </Button>
                      </form>
                      <form action={approveDraftAction.bind(null, draft.id)}>
                        <Button size="sm" type="submit">
                          Add to database
                        </Button>
                      </form>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Received {draft.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
