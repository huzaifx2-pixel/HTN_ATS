"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { JOB_IMPORT_TEMPLATE_CSV } from "@/lib/jobs/parse-job-import";
import {
  previewJobImportAction,
  confirmJobImportAction,
} from "@/app/actions";
import type {
  CsvSyncConfirmResult,
  CsvSyncPreviewResult,
  SyncPreviewItem,
} from "@/lib/jobs/csv-job-sync";

type BatchHistoryRow = {
  id: string;
  fileName: string;
  format: string;
  status: string;
  totalRows: number;
  newCount: number;
  created: number;
  imported: number;
  updated: number;
  reopened: number;
  willClose: number;
  closed: number;
  unchanged: number;
  conflict: number;
  invalid: number;
  duplicateRows: number;
  errors: number;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  errorMessage: string | null;
};

function formatWhen(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" | "ok" }) {
  const color =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ItemList({
  title,
  items,
  empty,
  defaultOpen,
}: {
  title: string;
  items: SyncPreviewItem[];
  empty?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {title}{" "}
          <span className="text-muted-foreground font-normal">({items.length})</span>
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="max-h-72 space-y-2 overflow-y-auto border-t border-border px-3 py-2">
          {items.length === 0 && empty ? (
            <p className="text-xs text-muted-foreground">{empty}</p>
          ) : (
            items.map((item, idx) => (
              <div key={`${item.classification}-${item.referralKey}-${item.rowNumber ?? idx}`} className="text-sm">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {item.clientName ? `${item.clientName} · ` : ""}
                  Referral {item.referralKey || "(none)"}
                  {item.rowNumber ? ` · Row ${item.rowNumber}` : ""}
                </div>
                {item.note && <div className="text-xs text-amber-700">{item.note}</div>}
                {item.reason && <div className="text-xs text-red-700">{item.reason}</div>}
                {item.fieldChanges && item.fieldChanges.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {item.fieldChanges.map((change) => (
                      <li key={change.field}>
                        <span className="font-medium text-foreground">{change.field}</span>:{" "}
                        {change.from ?? "—"} → {change.to ?? "—"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function JobFileImportPanel({ initialHistory }: { initialHistory: BatchHistoryRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvSyncPreviewResult | null>(null);
  const [result, setResult] = useState<CsvSyncConfirmResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [format, setFormat] = useState("csv");

  const grouped = useMemo(() => {
    if (!preview) return null;
    const all = preview.items;
    return {
      newItems: all.filter((i) => i.classification === "NEW"),
      updated: all.filter((i) => i.classification === "UPDATED"),
      reopened: all.filter((i) => i.classification === "REOPENED"),
      unchanged: all.filter((i) => i.classification === "UNCHANGED"),
      willClose: all.filter((i) => i.classification === "WILL_CLOSE"),
      conflict: all.filter((i) => i.classification === "CONFLICT"),
      invalid: all.filter((i) => i.classification === "INVALID" || i.classification === "DUPLICATE"),
    };
  }, [preview]);

  const onPreview = (formData: FormData) => {
    setError(null);
    setResult(null);
    setPreview(null);
    startTransition(async () => {
      try {
        const next = await previewJobImportAction(formData);
        setPreview(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to preview import");
      }
    });
  };

  const onConfirm = () => {
    if (!preview?.batchId) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await confirmJobImportAction(preview.batchId);
        setResult(next);
        if (next.status === "FAILED") {
          setError(next.errorMessage ?? "Sync failed");
          return;
        }
        setHistory((prev) => [
          {
            id: next.batchId,
            fileName: "(synced)",
            format,
            status: "COMPLETED",
            totalRows: preview.summary.totalRows,
            newCount: preview.summary.newCount,
            created: next.summary.created,
            imported: preview.summary.existingCount,
            updated: next.summary.updated,
            reopened: next.summary.reopened,
            willClose: 0,
            closed: next.summary.closed,
            unchanged: next.summary.unchanged,
            conflict: next.summary.conflict,
            invalid: preview.summary.invalid,
            duplicateRows: preview.summary.duplicateRows,
            errors: next.summary.errors,
            createdAt: new Date().toISOString(),
            confirmedAt: new Date().toISOString(),
            errorMessage: null,
          },
          ...prev,
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to sync jobs");
      }
    });
  };

  const onReset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-4">
        <form
          action={(fd) => onPreview(fd)}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onPreview(fd);
          }}
        >
          <div>
            <Label htmlFor="format">Format</Label>
            <select
              id="format"
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="file">File</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.json,.xlsx"
              required
              className="mt-1 block w-full text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Required: <code>Client</code>, <code>title</code>, and <code>Refferal Link</code> (referral
            spelling variants included). The Referral Link is the immutable job identity for sync.
            Also reads <code>Job Description</code>, <code>Openings</code>, <code>Required Skills</code>,
            and <code>Pay</code>. Unknown clients are created on confirm. Preview does not change jobs.
          </p>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending && !preview ? "Building preview…" : "Upload & Preview"}
            </Button>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(JOB_IMPORT_TEMPLATE_CSV)}`}
              download="job-import-template.csv"
              className="text-xs text-brand-700 hover:underline"
            >
              Download CSV template
            </a>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Job Sync Preview</h3>
            <p className="text-xs text-muted-foreground">
              {preview.summary.totalRows} rows in file · {preview.summary.existingCount} existing ·{" "}
              {preview.summary.newCount} new · Batch {preview.batchId}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="New" value={preview.summary.newCount} tone="ok" />
            <Stat label="Existing" value={preview.summary.existingCount} />
            <Stat label="Updated" value={preview.summary.updated} />
            <Stat label="Unchanged" value={preview.summary.unchanged} />
            <Stat label="Reopened" value={preview.summary.reopened} tone="ok" />
            <Stat label="Will Close" value={preview.summary.willClose} tone="danger" />
            <Stat label="Conflicts" value={preview.summary.conflict} tone="warn" />
            <Stat label="Invalid / Dupes" value={preview.summary.invalid + preview.summary.duplicateRows} tone="warn" />
          </div>

          {preview.blocked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="font-medium">Sync blocked until the file is corrected</div>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {preview.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {grouped && (
            <div className="space-y-2">
              <ItemList
                title="Jobs Will Be Closed"
                items={grouped.willClose}
                defaultOpen={grouped.willClose.length > 0}
              />
              {grouped.willClose.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  These jobs are currently OPEN, have a Referral Link identity, and are in the CSV sync
                  scope, but were not present in the uploaded file.
                </p>
              )}
              <ItemList title="New jobs" items={grouped.newItems} />
              <ItemList title="Updated jobs" items={grouped.updated} />
              <ItemList title="Reopened jobs" items={grouped.reopened} />
              <ItemList title="Conflicts" items={grouped.conflict} defaultOpen={grouped.conflict.length > 0} />
              <ItemList title="Invalid / duplicate rows" items={grouped.invalid} />
              <ItemList title="Unchanged" items={grouped.unchanged} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={onConfirm}
              disabled={pending || preview.blocked || Boolean(result && result.status === "COMPLETED")}
            >
              {pending ? "Syncing…" : "Sync Jobs"}
            </Button>
            <Button type="button" variant="outline" onClick={onReset} disabled={pending}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {result?.status === "COMPLETED" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <div className="font-medium">Sync complete</div>
          <div className="mt-1 text-xs">
            Created {result.summary.created} · Updated {result.summary.updated} · Reopened{" "}
            {result.summary.reopened} · Closed {result.summary.closed} · Unchanged{" "}
            {result.summary.unchanged} · Conflicts {result.summary.conflict}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Recent sync history</h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No import batches yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Counts</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.confirmedAt ?? row.createdAt)}</td>
                    <td className="px-3 py-2">{row.fileName}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.status === "PREVIEW"
                        ? `New ${row.newCount} · Existing ${row.imported || row.updated + row.unchanged + row.reopened + row.conflict} · Upd ${row.updated} · Unch ${row.unchanged} · Will close ${row.willClose}`
                        : `Created ${row.created || row.newCount} · Upd ${row.updated} · Unch ${row.unchanged} · Reopen ${row.reopened} · Closed ${row.closed}`}
                      {row.errorMessage ? ` · ${row.errorMessage}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
