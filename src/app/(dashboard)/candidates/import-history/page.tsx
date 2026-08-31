import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import {
  getResumeImportStats,
  listResumeImportHistory,
} from "@/lib/services/resume-import-service";
import { formatCandidateSource } from "@/lib/services/candidate-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CandidateSource } from "@prisma/client";

export default async function ResumeImportHistoryPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const orgId = member.organizationId;
  const [history, stats] = await Promise.all([
    listResumeImportHistory(orgId),
    getResumeImportStats(orgId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume Import History"
        description="Every resume processed by the import engine"
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.todayCount}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Failed Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.failed}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Duplicates Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.duplicates}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">All Time</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.total}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Imports</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">File</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Candidate</th>
                <th className="py-2 pr-4">Duration</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-muted-foreground">No imports logged yet</td></tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 whitespace-nowrap">{format(row.createdAt, "MMM d, h:mm a")}</td>
                    <td className="py-2 pr-4">{row.fileName}</td>
                    <td className="py-2 pr-4">{formatCandidateSource(row.source as CandidateSource)}</td>
                    <td className="py-2 pr-4">
                      <span className={row.status === "FAILED" ? "text-red-600" : row.status === "DUPLICATE" ? "text-amber-700" : "text-brand-700"}>
                        {row.status}
                      </span>
                      {row.parseError && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.parseError}>
                          {row.parseError}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {row.candidate ? (
                        <Link href={`/candidates/${row.candidate.id}`} className="text-brand-700 hover:underline">
                          {row.candidate.firstName} {row.candidate.lastName}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-4">{row.durationMs ? `${row.durationMs}ms` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
