"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importMicro1ReferralCsvAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Micro1ImportResult } from "@/lib/referrals/micro1-referral-sync";

type HistoryRow = {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  matched: number;
  unmatched: number;
  needsReview: number;
  statusChanges: number;
  errorMessage: string | null;
};

export function ReferralImportPanel({ history }: { history: HistoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ message: string; file: File } | null>(null);
  const [summary, setSummary] = useState<Micro1ImportResult | null>(null);

  function run(file: File, force: boolean) {
    const data = new FormData();
    data.set("file", file);
    if (force) data.set("force", "true");
    startTransition(async () => {
      try {
        const result = await importMicro1ReferralCsvAction(data);
        if ("alreadyImported" in result && result.alreadyImported) {
          setDuplicate({ message: result.message, file });
          setSummary(null);
          setMessage(null);
          return;
        }
        setDuplicate(null);
        setSummary(result as Micro1ImportResult);
        setMessage((result as Micro1ImportResult).summaryLine);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Import failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="text-sm font-semibold">Import micro1 CSV</div>
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) run(file, false);
        }}
      />
      {duplicate ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p>{duplicate.message}</p>
          <Button className="mt-2" size="sm" disabled={pending} onClick={() => run(duplicate.file, true)}>
            Re-run import
          </Button>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {summary ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>{summary.validCount} records imported</div>
          <div>{summary.matched} matched</div>
          <div>{summary.unmatched} unmatched</div>
          <div>{summary.needsReview} require review</div>
          <div>{summary.statusChanges} status changes</div>
          <div>{summary.createdCount} new · {summary.updatedCount} updated</div>
        </div>
      ) : null}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Import history</div>
        <ul className="space-y-1 text-xs">
          {history.length === 0 ? (
            <li className="text-muted-foreground">No imports yet</li>
          ) : (
            history.map((row) => (
              <li key={row.id} className="flex justify-between gap-2">
                <Link href={`/referrals/imports/${row.id}`} className="text-[#1e4e8c] hover:underline truncate">
                  {new Date(row.createdAt).toLocaleString()} · {row.fileName}
                </Link>
                <span>
                  {row.validCount}/{row.totalRows} · {row.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
