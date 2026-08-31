"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, Trash2, UserCheck, Ban, Megaphone } from "lucide-react";
import { bulkCandidateAction, importCandidatesToAudienceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { formatJobTimestamp, cn } from "@/lib/utils";
import { sanitizeCandidateEmail } from "@/lib/sanitize-contact";
import { useVirtualWindow } from "@/components/shared/use-virtual-window";

type CandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  currentRole: string | null;
  email: string | null;
  source: string;
  sourceLabel: string;
  createdAt: string;
};

export function CandidateTable({ candidates }: { candidates: CandidateRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const virtual = useVirtualWindow(candidates.length);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map((c) => c.id)));
  };

  const runBulk = (action: "delete" | "engage" | "dnc" | "clear_dnc") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkCandidateAction(action, ids);
        setMessage(result.message);
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Action failed");
      }
    });
  };

  const importToAudience = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const name = window.prompt("Audience name", `Imported candidates (${ids.length})`);
    if (!name?.trim()) return;
    startTransition(async () => {
      try {
        const result = await importCandidatesToAudienceAction({ name: name.trim(), candidateIds: ids });
        setMessage(result.message);
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Import failed");
      }
    });
  };

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk("engage")}>
            <UserCheck className="mr-1 h-3.5 w-3.5" /> Mark engaged
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={importToAudience}>
            <Megaphone className="mr-1 h-3.5 w-3.5" /> Import to audience
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk("dnc")}>
            <Ban className="mr-1 h-3.5 w-3.5" /> Mark DNC
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk("delete")}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Move to recycle bin
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={`/messages/templates?candidateIds=${[...selected].join(",")}`}>
              <Mail className="mr-1 h-3.5 w-3.5" /> Email
            </Link>
          </Button>
        </div>
      )}

      {message && <p className="px-4 py-2 text-xs text-muted-foreground">{message}</p>}

      <div className="overflow-auto max-h-[560px]" onScroll={virtual.onScroll}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2 text-left">
                <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0} onChange={toggleAll} />
              </th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Source</th>
              <th className="px-4 py-2 text-left font-medium">Imported</th>
              <th className="px-4 py-2 text-left font-medium">Quick</th>
            </tr>
          </thead>
          <tbody>
            {virtual.spacers.top > 0 && (
              <tr aria-hidden>
                <td colSpan={7} style={{ height: virtual.spacers.top, padding: 0, border: 0 }} />
              </tr>
            )}
            {candidates.slice(virtual.start, virtual.end).map((candidate) => (
              <tr key={candidate.id} className={cn("border-b border-border/50 hover:bg-muted/30", selected.has(candidate.id) && "bg-brand-50/40")}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(candidate.id)} onChange={() => toggle(candidate.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/candidates/${candidate.id}`} className="font-medium text-brand-700 hover:underline">
                    {candidate.firstName} {candidate.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{candidate.currentRole ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{sanitizeCandidateEmail(candidate.email) ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    {candidate.sourceLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatJobTimestamp(new Date(candidate.createdAt))}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/candidates/${candidate.id}`} className="text-brand-700 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {virtual.spacers.bottom > 0 && (
              <tr aria-hidden>
                <td colSpan={7} style={{ height: virtual.spacers.bottom, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
