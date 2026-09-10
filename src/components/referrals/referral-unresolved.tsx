"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  leaveMicro1ReferralUnmatchedAction,
  linkMicro1ReferralAction,
  searchMicro1LinkCandidatesAction,
} from "@/app/actions";
import { ReferralDeleteButton } from "@/components/referrals/referral-delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MatchFilter = "UNMATCHED" | "MATCHED" | "NEEDS_REVIEW";

type Row = {
  id: string;
  csvName: string;
  matchingStatus: string;
  matchingConfidence: number | null;
  matchingReason: string | null;
  suggested: { id: string; name: string } | null;
};

const FILTERS: Array<{
  key: MatchFilter;
  title: string;
  dot: string;
  ring: string;
}> = [
  { key: "UNMATCHED", title: "Unmatched", dot: "bg-rose-500", ring: "ring-rose-500" },
  { key: "MATCHED", title: "Matched", dot: "bg-emerald-500", ring: "ring-emerald-500" },
  { key: "NEEDS_REVIEW", title: "Needs review", dot: "bg-amber-400", ring: "ring-amber-400" },
];

function bucket(status: string): MatchFilter | null {
  if (status === "MATCHED") return "MATCHED";
  if (status === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  if (status === "UNMATCHED" || status === "LEFT_UNMATCHED") return "UNMATCHED";
  return null;
}

export function ReferralUnresolved({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchFor, setSearchFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; name: string; role: string | null }>>([]);
  const [active, setActive] = useState<Set<MatchFilter>>(
    () => new Set(["UNMATCHED", "NEEDS_REVIEW"]),
  );

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function toggle(key: MatchFilter) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const visible = useMemo(
    () => rows.filter((row) => {
      const key = bucket(row.matchingStatus);
      return key != null && active.has(key);
    }),
    [rows, active],
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Unresolved matches</div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Match status filters">
          {FILTERS.map((filter) => {
            const on = active.has(filter.key);
            return (
              <button
                key={filter.key}
                type="button"
                title={filter.title}
                aria-label={filter.title}
                aria-pressed={on}
                onClick={() => toggle(filter.key)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition",
                  on ? "ring-2 ring-offset-1 ring-offset-card" : "opacity-40 hover:opacity-80",
                  on && filter.ring,
                )}
              >
                <span className={cn("h-3.5 w-3.5 rounded-full", filter.dot)} />
              </button>
            );
          })}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No referrals in the selected match states.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <li key={row.id} className="border-b border-border/60 pb-3 last:border-0">
              <div className="flex items-center gap-1.5">
                <div className="font-medium">{row.csvName}</div>
                <ReferralDeleteButton referralId={row.id} name={row.csvName} />
              </div>
              <Badge
                variant={
                  row.matchingStatus === "MATCHED"
                    ? "success"
                    : row.matchingStatus === "NEEDS_REVIEW"
                      ? "warning"
                      : "destructive"
                }
              >
                {row.matchingStatus === "MATCHED"
                  ? "Matched"
                  : row.matchingStatus === "NEEDS_REVIEW"
                    ? "Needs review"
                    : row.matchingStatus === "LEFT_UNMATCHED"
                      ? "Left unmatched"
                      : "Unmatched"}
              </Badge>
              {row.suggested ? (
                <p className="mt-1 text-sm">
                  Suggested: {row.suggested.name}
                  {row.matchingConfidence != null ? ` · ${Math.round(row.matchingConfidence * 100)}%` : ""}
                  {row.matchingReason ? ` · ${row.matchingReason}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{row.matchingReason ?? "No ATS match"}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {row.suggested && row.matchingStatus !== "MATCHED" ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => act(() => linkMicro1ReferralAction(row.id, row.suggested!.id))}
                  >
                    Link
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setSearchFor(row.id);
                    setQuery(row.csvName);
                  }}
                >
                  Search candidates
                </Button>
                {row.matchingStatus !== "MATCHED" && row.matchingStatus !== "LEFT_UNMATCHED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => act(() => leaveMicro1ReferralUnmatchedAction(row.id))}
                  >
                    Leave unmatched
                  </Button>
                ) : null}
              </div>
              {searchFor === row.id ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-9 w-full rounded-md border border-border px-2 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setHits(await searchMicro1LinkCandidatesAction(query));
                      })
                    }
                  >
                    Search
                  </Button>
                  <ul className="text-sm">
                    {hits.map((hit) => (
                      <li key={hit.id} className="flex items-center justify-between py-1">
                        <span>
                          {hit.name}
                          {hit.role ? ` · ${hit.role}` : ""}
                        </span>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            act(async () => {
                              await linkMicro1ReferralAction(row.id, hit.id);
                              setSearchFor(null);
                            })
                          }
                        >
                          Link
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
