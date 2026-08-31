"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveBooleanSearchToJobAction } from "@/app/actions";
import { SourcingJobSelect, type SourcingJobOption } from "@/components/candidates/sourcing-job-select";
import type { CandidateSearchMode } from "@/lib/services/search-utils";
import {
  clearRecentTalentSearches,
  readRecentTalentSearches,
  removeRecentTalentSearch,
  type RecentTalentSearch,
} from "@/lib/candidates/recent-talent-searches";

type SearchPanelTab = CandidateSearchMode | "recent";

const MODES: Array<{ key: CandidateSearchMode; label: string; placeholder: string; hint: string }> = [
  {
    key: "name",
    label: "Name",
    placeholder: "e.g. Priya Sharma or priya@email.com",
    hint: "Search by first name, last name, or email.",
  },
  {
    key: "skill",
    label: "Skill",
    placeholder: "e.g. React, AWS, project management",
    hint: "Match skills on the profile, normalized skill list, or resume text.",
  },
  {
    key: "boolean",
    label: "Boolean",
    placeholder: 'e.g. (Java OR Kotlin) AND Spring NOT intern',
    hint: "Use AND, OR, NOT, quotes, and parentheses against resume text.",
  },
  {
    key: "all",
    label: "All",
    placeholder: "Search name, role, company, skills, resume...",
    hint: "Broad search across profile and resume fields.",
  },
];

const URL_KEYS_OWNED_BY_PANEL = new Set(["q", "mode", "jobId", "cursor"]);

export function CandidateSearchPanel({
  jobs,
  userId,
  initialQuery = "",
  initialMode = "name",
  initialJobId = "",
}: {
  jobs: SourcingJobOption[];
  userId: string;
  initialQuery?: string;
  initialMode?: CandidateSearchMode;
  initialJobId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<CandidateSearchMode>(initialMode);
  const [tab, setTab] = useState<SearchPanelTab>(initialMode);
  const [jobId, setJobId] = useState(initialJobId);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [recents, setRecents] = useState<RecentTalentSearch[]>(() => readRecentTalentSearches(userId));
  const activeMode = MODES.find((item) => item.key === mode) ?? MODES[0]!;
  const selectedJob = jobs.find((job) => job.id === jobId);

  function refreshRecents() {
    setRecents(readRecentTalentSearches(userId));
  }

  function searchUrl(next: { query: string; mode: CandidateSearchMode; jobId: string }) {
    const params = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (!URL_KEYS_OWNED_BY_PANEL.has(key)) params.set(key, value);
    }
    const trimmed = next.query.trim();
    if (trimmed) params.set("q", trimmed);
    params.set("mode", next.mode);
    if (next.jobId) params.set("jobId", next.jobId);
    return `/candidates/search?${params.toString()}`;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed && !jobId) {
      router.push("/candidates/search");
      return;
    }
    router.push(searchUrl({ query: trimmed, mode, jobId }));
  }

  function onJobChange(nextJobId: string) {
    setJobId(nextJobId);
    setSaveMessage(null);
    const job = jobs.find((item) => item.id === nextJobId);
    if (job?.booleanSearch?.trim()) {
      setQuery(job.booleanSearch);
      setMode("boolean");
      router.push(searchUrl({ query: job.booleanSearch, mode: "boolean", jobId: nextJobId }));
      return;
    }
    if (nextJobId) {
      setMode("boolean");
    }
  }

  function saveToJob() {
    if (!jobId) return;
    const trimmed = query.trim();
    startTransition(async () => {
      try {
        const saved = await saveBooleanSearchToJobAction(jobId, trimmed);
        setSaveMessage(`Saved boolean to ${saved.jobCode}`);
        router.refresh();
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : "Failed to save to job");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setMode(item.key);
              setTab(item.key);
            }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === item.key
                ? "border-brand-700 text-brand-700 font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            refreshRecents();
            setTab("recent");
          }}
          className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            tab === "recent"
              ? "border-brand-700 text-brand-700 font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recent
        </button>
      </div>

      {tab === "recent" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Searches you have run, newest first.</p>
            {recents.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  clearRecentTalentSearches(userId);
                  refreshRecents();
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {recents.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No recent searches yet. Run a name, skill, boolean, or all search and it will show up here.
            </p>
          ) : (
            <div className="divide-y rounded-lg border border-border/70">
              {recents.map((item) => (
                <div key={item.href} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => router.push(item.href)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium">{item.label}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 capitalize">
                        <Clock className="h-3 w-3" />
                        {item.mode}
                      </span>
                      <span>{formatDistanceToNow(item.queriedAt, { addSuffix: true })}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove recent search"
                    onClick={() => {
                      removeRecentTalentSearch(userId, item.href);
                      refreshRecents();
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSaveMessage(null);
            }}
            placeholder={activeMode.placeholder}
            className="pl-9 pr-24"
            aria-label="Candidate search"
          />
          <Button type="submit" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-8">
            Search
          </Button>
        </div>

        {mode === "boolean" ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="sourcing-job" className="text-xs">
                Sourcing for
              </Label>
              <SourcingJobSelect jobs={jobs} value={jobId} onChange={onJobChange} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!jobId || !query.trim() || pending}
              onClick={saveToJob}
            >
              {pending ? "Saving…" : "Save to job"}
            </Button>
            {selectedJob ? (
              <Button type="button" size="sm" variant="ghost" asChild>
                <Link href={`/jobs/${selectedJob.id}`}>Open job</Link>
              </Button>
            ) : null}
            {saveMessage ? (
              <p className="w-full text-xs text-muted-foreground">{saveMessage}</p>
            ) : selectedJob ? (
              <p className="w-full text-xs text-muted-foreground">
                {selectedJob.booleanSearch?.trim()
                  ? `This search is tied to ${selectedJob.jobCode}. Save to job stores the current boolean on that requisition.`
                  : `No boolean saved on ${selectedJob.jobCode} yet. Search, then Save to job.`}
              </p>
            ) : (
              <p className="w-full text-xs text-muted-foreground">
                Pick the job you are sourcing for so this boolean is saved on that requisition.
              </p>
            )}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">{activeMode.hint}</p>
      </form>
      )}
    </div>
  );
}
