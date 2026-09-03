import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MatchCandidateEmail } from "@/components/jobs/match-candidate-email";
import { MatchingHubEmail } from "@/components/matching/matching-hub-email";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { MatchScoreBadge } from "@/components/ui/badge";
import { FOLLOW_UP_AFTER_DAYS, type MatchingRecipientGroup } from "@/lib/services/match-email-outreach-service";

type EmailTemplate = { id: string; name: string; subject: string; body: string };

export function MatchingFollowUpPanel({
  groups,
  templates,
  gmailConnected,
  userEmail,
  recruiterName,
}: {
  groups: MatchingRecipientGroup[];
  templates: EmailTemplate[];
  gmailConnected: boolean;
  userEmail?: string;
  recruiterName: string;
}) {
  const total = groups.reduce((sum, group) => sum + group.recipients.length, 0);

  if (total === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            title="No follow-ups due"
            description={`Candidates show up here ${FOLLOW_UP_AFTER_DAYS} days after outreach if they have not applied or replied.`}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.jobId}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-sm">
                <Link href={`/jobs/${group.jobId}?tab=matching`} className="text-brand-700 hover:underline">
                  {group.jobTitle}
                </Link>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {group.jobCode} · {group.clientName} · {group.jobLocation} · {group.recipients.length} due
              </p>
            </div>
            <MatchingHubEmail
              mode="followup"
              jobId={group.jobId}
              remainingCount={group.recipients.length}
              jobTitle={group.jobTitle}
              jobCode={group.jobCode}
              clientName={group.clientName}
              jobLocation={group.jobLocation}
              jobSalary={group.jobSalary}
              applyLink={group.applyLink}
              recruiterName={recruiterName}
              templates={templates}
              gmailConnected={gmailConnected}
              userEmail={userEmail}
              triggerSize="sm"
              triggerVariant="outline"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {group.recipients.map((recipient) => (
              <div
                key={recipient.candidateId}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/candidates/${recipient.candidateId}`}
                    className="font-medium text-sm text-brand-700 hover:underline"
                  >
                    {recipient.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{recipient.email}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Last emailed{" "}
                    {recipient.lastSentAt
                      ? formatDistanceToNow(new Date(recipient.lastSentAt), { addSuffix: true })
                      : "—"}
                    {recipient.openedAt ? " · Opened" : " · Not opened"}
                    {recipient.emailsSent ? ` · ${recipient.emailsSent} sent` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {recipient.score != null && <MatchScoreBadge score={recipient.score} />}
                  <MatchCandidateEmail
                    jobId={group.jobId}
                    candidateId={recipient.candidateId}
                    candidateName={recipient.name}
                    candidateEmail={recipient.email}
                    jobTitle={group.jobTitle}
                    jobCode={group.jobCode}
                    clientName={group.clientName}
                    jobLocation={group.jobLocation}
                    jobSalary={group.jobSalary}
                    applyLink={group.applyLink}
                    recruiterName={recruiterName}
                    templates={templates}
                    gmailConnected={gmailConnected}
                    userEmail={userEmail}
                    skipDuplicateCheck
                    triggerLabel="Follow up"
                    dialogTitle={`Follow up with ${recipient.name}`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
