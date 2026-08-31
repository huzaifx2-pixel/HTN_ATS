"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import Link from "next/link";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { formatJobTimestamp } from "@/lib/utils";
import { resolveJobDisplayDate } from "@/lib/format-job";
import type { JobMatchEmailStats } from "@/lib/services/match-email-outreach-service";
import { useVirtualWindow } from "@/components/shared/use-virtual-window";
import { bulkJobAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Archive, Download, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type JobRow = {
  id: string;
  jobCode: string;
  title: string;
  client: { id: string; name: string; prefix: string };
  booleanSearch?: string | null;
  _count?: { matches: number; applications: number };
  emailStats?: JobMatchEmailStats;
  openings: number;
  status: string;
  postedAt?: Date | null;
  importedAt?: Date | null;
  closedAt?: Date | null;
  externalSource?: string | null;
  source?: string | null;
  createdAt?: Date;
};

function EmailSendCell({ job }: { job: JobRow }) {
  if (!job.booleanSearch?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }

  const stats = job.emailStats;
  if (!stats || stats.eligibleMatches === 0) {
    return <span className="text-muted-foreground">0</span>;
  }

  return (
    <Link
      href={`/jobs/${job.id}?tab=matching`}
      className={
        stats.emailsPending > 0
          ? "font-medium text-amber-700 hover:underline"
          : "text-brand-700 hover:underline font-medium"
      }
      title={`${stats.emailsSent} sent · ${stats.emailsPending} not sent`}
    >
      {stats.emailsSent}/{stats.eligibleMatches}
    </Link>
  );
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CompactJobTable({
  jobs,
  view = "open",
  emptyMessage = "No jobs yet",
  canDelete = false,
  assignees = [],
}: {
  jobs: JobRow[];
  view?: "open" | "closed";
  emptyMessage?: string;
  canDelete?: boolean;
  assignees?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timeLabel = view === "closed" ? "Closed" : "Posted";
  const virtual = useVirtualWindow(jobs.length);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === jobs.length) setSelected(new Set());
    else setSelected(new Set(jobs.map((job) => job.id)));
  };

  const runBulk = (action: "close" | "delete" | "assign" | "export") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkJobAction(action, ids, assigneeId || undefined);
        if ("csv" in result && result.csv && result.fileName) {
          downloadCsv(result.fileName, result.csv);
        }
        setMessage(result.message);
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Action failed");
      }
    });
  };

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            title={emptyMessage}
            description={
              view === "open"
                ? "Import from the website or create a job to get started"
                : "Jobs no longer on the website are moved here when sync runs"
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
            <span className="text-xs font-medium">{selected.size} job(s) selected</span>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk("export")}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk("close")}>
              <Archive className="mr-1 h-3.5 w-3.5" /> Archive
            </Button>
            {assignees.length > 0 ? (
              <>
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                >
                  <option value="">Assign to…</option>
                  {assignees.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !assigneeId}
                  onClick={() => runBulk("assign")}
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Assign
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk("delete")}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            ) : null}
          </div>
        )}
        {message ? <p className="px-4 py-2 text-xs text-muted-foreground">{message}</p> : null}

        <div className="overflow-auto max-h-[560px]" onScroll={virtual.onScroll}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === jobs.length && jobs.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-2 text-left font-medium">Job ID</th>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-right font-medium">Matches</th>
                <th className="px-4 py-2 text-right font-medium">Email Send</th>
                <th className="px-4 py-2 text-right font-medium">Applicants</th>
                <th className="px-4 py-2 text-right font-medium">Openings</th>
                <th className="px-4 py-2 text-left font-medium">{timeLabel}</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {virtual.spacers.top > 0 && (
                <tr aria-hidden>
                  <td colSpan={10} style={{ height: virtual.spacers.top, padding: 0, border: 0 }} />
                </tr>
              )}
              {jobs.slice(virtual.start, virtual.end).map((job) => {
                const timestamp = view === "closed" ? job.closedAt : resolveJobDisplayDate(job);

                return (
                  <tr
                    key={job.id}
                    className={cn("border-b border-border/50 hover:bg-muted/30", selected.has(job.id) && "bg-brand-50/40")}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(job.id)} onChange={() => toggle(job.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="font-mono text-brand-700 hover:underline">
                        {job.jobCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium text-brand-700 hover:underline">
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/clients?client=${job.client.id}`} className="hover:underline text-brand-700">
                        {job.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/jobs/${job.id}?tab=matching`}
                        className="text-brand-700 hover:underline font-medium"
                      >
                        {job._count?.matches ?? 0}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <EmailSendCell job={job} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/jobs/${job.id}?tab=applicants`}
                        className="text-brand-700 hover:underline font-medium"
                      >
                        {job._count?.applications ?? 0}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{job.openings}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatJobTimestamp(timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                );
              })}
              {virtual.spacers.bottom > 0 && (
                <tr aria-hidden>
                  <td colSpan={10} style={{ height: virtual.spacers.bottom, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function CandidateListItem({
  candidate,
}: {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    currentRole?: string | null;
    experienceYears?: number | null;
    skills: string[] | unknown;
  };
}) {
  const skills = Array.isArray(candidate.skills)
    ? candidate.skills.filter((s): s is string => typeof s === "string")
    : [];

  return (
    <Link href={`/candidates/${candidate.id}`} className="flex items-center gap-3 py-2 hover:bg-muted/30 rounded-lg px-1 -mx-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700/10 text-xs font-medium text-brand-700">
        {candidate.firstName[0]}{candidate.lastName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</div>
        <div className="text-xs text-muted-foreground">
          {candidate.currentRole ?? "—"} · {candidate.experienceYears ?? 0} yrs
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
