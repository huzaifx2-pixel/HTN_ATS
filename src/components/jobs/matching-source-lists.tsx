import type { ComponentProps } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { MatchScoreBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchAnalysisPanel } from "@/components/jobs/match-analysis-panel";
import { MatchCandidateEmail } from "@/components/jobs/match-candidate-email";
import { addCandidateToJobAction } from "@/app/actions";

type MatchRow = {
  id: string;
  candidateId: string;
  score: number;
  skillsMatch: number;
  experienceMatch: number;
  descriptionMatch: number;
  semanticScore?: number | null;
  reason: string | null;
  candidate: {
    firstName: string;
    lastName: string;
    currentRole: string | null;
    email?: string | null;
  };
};

export function ReferralMatchesPanel({
  jobId,
  matches,
  emailProps,
}: {
  jobId: string;
  matches: MatchRow[];
  emailProps: Omit<ComponentProps<typeof MatchCandidateEmail>, "candidateId" | "candidateName" | "candidateEmail">;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Referral Matches</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Candidates who applied or were sourced as referrals and still match this job.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches.length === 0 ? (
          <EmptyState
            title="No referral matches"
            description="Referral applicants who match this Boolean will appear here."
          />
        ) : (
          matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
              <div className="min-w-0">
                <Link href={`/candidates/${m.candidateId}`} className="font-medium text-sm text-brand-700 hover:underline">
                  {m.candidate.firstName} {m.candidate.lastName}
                </Link>
                <div className="text-xs text-muted-foreground">{m.candidate.currentRole}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.reason}</div>
                <MatchAnalysisPanel
                  jobId={jobId}
                  candidateId={m.candidateId}
                  candidateName={`${m.candidate.firstName} ${m.candidate.lastName}`}
                />
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-2">
                <MatchScoreBadge score={m.score} />
                <div className="flex gap-2">
                  <MatchCandidateEmail
                    {...emailProps}
                    candidateId={m.candidateId}
                    candidateName={`${m.candidate.firstName} ${m.candidate.lastName}`}
                    candidateEmail={m.candidate.email}
                  />
                  <form action={addCandidateToJobAction.bind(null, jobId, m.candidateId)}>
                    <Button type="submit" size="sm" variant="outline">Add to job</Button>
                  </form>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function ImportedCandidatesPanel({
  rows,
}: {
  rows: Array<{
    id: string;
    importedAt: Date | null;
    linkedInUrl: string;
    fullName: string;
    currentTitle: string | null;
    matchScore: number;
    importedCandidate: {
      id: string;
      firstName: string;
      lastName: string;
      currentRole: string | null;
      email: string | null;
      linkedIn: string | null;
    } | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Imported Candidates</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          LinkedIn Matches imported into the ATS for this job.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No imported LinkedIn candidates"
            description="Use Import on the LinkedIn Matches tab to create ATS records."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Candidate</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Imported</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const candidate = row.importedCandidate;
                  const name = candidate
                    ? `${candidate.firstName} ${candidate.lastName}`
                    : row.fullName;
                  return (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-3 pr-3">
                        {candidate ? (
                          <Link href={`/candidates/${candidate.id}`} className="font-medium text-brand-700 hover:underline">
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium">{name}</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{candidate?.currentRole || row.currentTitle || "—"}</td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {row.importedAt ? new Date(row.importedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <a href={row.linkedInUrl} target="_blank" rel="noreferrer">View Profile</a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
