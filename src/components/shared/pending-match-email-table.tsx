import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { formatJobTimestamp } from "@/lib/utils";
import { resolveJobDisplayDate } from "@/lib/format-job";
import type { JobMatchEmailStats } from "@/lib/services/match-email-outreach-service";

type PendingEmailJobRow = {
  id: string;
  jobCode: string;
  title: string;
  client: { name: string };
  _count?: { matches: number; applications: number };
  postedAt?: Date | null;
  importedAt?: Date | null;
  externalSource?: string | null;
  source?: string | null;
  createdAt?: Date;
  emailStats: JobMatchEmailStats;
};

export function PendingMatchEmailTable({ jobs }: { jobs: PendingEmailJobRow[] }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            title="No pending match emails"
            description="All matched candidates with email addresses have been contacted, or there are no open jobs with matches yet."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Jobs with unmatched outreach ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Job ID</th>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-right font-medium">Matches</th>
                <th className="px-4 py-2 text-right font-medium">Email Sent</th>
                <th className="px-4 py-2 text-right font-medium">Not Sent</th>
                <th className="px-4 py-2 text-left font-medium">Posted</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-mono text-brand-700 hover:underline">
                      {job.jobCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}?tab=matching`} className="font-medium text-brand-700 hover:underline">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{job.client.name}</td>
                  <td className="px-4 py-3 text-right">{job._count?.matches ?? 0}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {job.emailStats.emailsSent}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/jobs/${job.id}?tab=matching`}
                      className="font-medium text-amber-700 hover:underline"
                    >
                      {job.emailStats.emailsPending}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatJobTimestamp(resolveJobDisplayDate(job))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
