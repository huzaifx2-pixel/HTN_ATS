import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { exportBatchResultsCsv, getImportBatch, STAGE_LABELS } from "@/lib/services/micro1-referral-service";
import type { Micro1ImportResult } from "@/lib/referrals/micro1-referral-sync";
import { PageHeader } from "@/components/shared/dashboard-widgets";

export default async function ReferralImportDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");
  const { batchId } = await params;
  const batch = await getImportBatch(batchId, member.organizationId);
  if (!batch) notFound();
  const result = (batch.resultJson ?? null) as Micro1ImportResult | null;
  const csv = exportBatchResultsCsv(batch.resultJson);

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.fileName}
        description={`${batch.status} · ${batch.validCount} valid · ${batch.invalidCount} invalid`}
        actions={
          <a
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
            download={`${batch.fileName.replace(/\.csv$/i, "")}-results.csv`}
          >
            Export Results CSV
          </a>
        }
      />
      <Link href="/referrals" className="text-sm text-[#1e4e8c] hover:underline">
        Back to referrals
      </Link>
      {batch.errorMessage ? <p className="text-sm text-red-700">{batch.errorMessage}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
        <div>Matched: {batch.matched}</div>
        <div>Unmatched: {batch.unmatched}</div>
        <div>Needs review: {batch.needsReview}</div>
        <div>Status changes: {batch.statusChanges}</div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2">Candidate</th>
              <th className="px-3 py-2">Previous</th>
              <th className="px-3 py-2">New</th>
              <th className="px-3 py-2">Change</th>
              <th className="px-3 py-2">Matching</th>
            </tr>
          </thead>
          <tbody>
            {(result?.diffs ?? []).map((row, index) => (
              <tr key={`${row.identityKey}-${index}`} className="border-b border-border/60">
                <td className="px-3 py-2">{row.csvName || "—"}</td>
                <td className="px-3 py-2">{row.previousStage ? STAGE_LABELS[row.previousStage] : "—"}</td>
                <td className="px-3 py-2">{STAGE_LABELS[row.newStage]}</td>
                <td className="px-3 py-2">
                  {row.change}
                  {row.reason ? ` · ${row.reason}` : ""}
                </td>
                <td className="px-3 py-2">{row.matchingStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
