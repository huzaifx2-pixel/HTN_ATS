"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { LinkedInMatchScore } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";

type LinkedInMatchRow = {
  id: string;
  fullName: string;
  linkedInUrl: string;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  education: string | null;
  experienceYears: number | null;
  photoUrl: string | null;
  matchScore: number;
  matchLabel: string | null;
  skills: unknown;
};

type Stats = {
  found: number;
  imported: number;
  conversionRate: number;
  emailed: number;
  openRate: number;
  interviewing: number;
  hired: number;
};

const emptyStats: Stats = {
  found: 0,
  imported: 0,
  conversionRate: 0,
  emailed: 0,
  openRate: 0,
  interviewing: 0,
  hired: 0,
};

function experienceLabel(years: number | null) {
  if (years == null) return "—";
  return `${years}+ years`;
}

function linkedInPath(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function LinkedInMatchesPanel({
  jobId,
  hasBoolean,
}: {
  jobId: string;
  hasBoolean: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LinkedInMatchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [configured, setConfigured] = useState(true);
  const [hasEngineId, setHasEngineId] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (location.trim()) params.set("location", location.trim());
    if (company.trim()) params.set("company", company.trim());
    if (education.trim()) params.set("education", education.trim());
    if (experience) params.set("experience", experience);
    params.set("page", String(page));
    return params.toString();
  }, [search, location, company, education, experience, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/linkedin-matches?${queryString}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load LinkedIn matches");
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPageCount(data.pageCount ?? 1);
      setStats(data.stats ?? emptyStats);
      setConfigured(Boolean(data.configured));
      setHasEngineId(Boolean(data.cse?.hasEngineId));
      setHasApiKey(Boolean(data.cse?.hasApiKey));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load LinkedIn matches");
    } finally {
      setLoading(false);
    }
  }, [jobId, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/linkedin-matches/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      setQuery(data.query ?? "");
      setPage(1);
      await load();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function importRows(ids?: string[], all = false) {
    if (all) setImportingAll(true);
    else if (ids?.[0]) setImportingId(ids[0]);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/linkedin-matches/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          all
            ? { all: true, search, location, company, education, experience }
            : { ids }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      await load();
      router.refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setImportingAll(false);
      setImportingId(null);
    }
  }

  const filterClass =
    "h-10 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground";

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base">LinkedIn Matches</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Candidates discovered from LinkedIn using the saved Boolean search for this job.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing || !hasBoolean}>
              {refreshing ? "Refreshing…" : "Refresh Matches"}
            </Button>
            <Button size="sm" onClick={() => void importRows(undefined, true)} disabled={importingAll || items.length === 0}>
              {importingAll ? "Importing…" : `Import All${total > 0 ? ` (${Math.min(total, 50)})` : ""}`}
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/jobs/${jobId}/linkedin-matches/export`}>Export Results</a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Profiles found</div>
            <div className="text-sm font-semibold mt-0.5">{stats.found}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Imported</div>
            <div className="text-sm font-semibold mt-0.5">{stats.imported} ({stats.conversionRate}%)</div>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Email open rate</div>
            <div className="text-sm font-semibold mt-0.5">{stats.openRate}%</div>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <div className="text-muted-foreground">Interviews / hires</div>
            <div className="text-sm font-semibold mt-0.5">{stats.interviewing} / {stats.hired}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by name, title, company, skills…"
            className="min-w-[240px] flex-1"
          />
          <Input
            value={location}
            onChange={(event) => {
              setPage(1);
              setLocation(event.target.value);
            }}
            placeholder="Location"
            className="w-40"
          />
          <select
            value={experience}
            onChange={(event) => {
              setPage(1);
              setExperience(event.target.value);
            }}
            className={filterClass}
          >
            <option value="">Experience</option>
            <option value="under3">Under 3 years</option>
            <option value="3to5">3–5 years</option>
            <option value="5plus">5+ years</option>
          </select>
          <Input
            value={company}
            onChange={(event) => {
              setPage(1);
              setCompany(event.target.value);
            }}
            placeholder="Current Company"
            className="w-44"
          />
          <Input
            value={education}
            onChange={(event) => {
              setPage(1);
              setEducation(event.target.value);
            }}
            placeholder="Education"
            className="w-40"
          />
        </div>
      </CardHeader>
      <CardContent>
        {!hasBoolean ? (
          <EmptyState
            title="Boolean search required"
            description="Save a Boolean query on the job Overview or Edit tab, then refresh LinkedIn matches."
          />
        ) : !configured ? (
          <EmptyState
            title={hasEngineId && !hasApiKey ? "Google API key still needed" : "Google search not configured"}
            description={
              hasEngineId && !hasApiKey
                ? "Your Programmable Search engine ID is saved. Add a Google Cloud API key with Custom Search API enabled to GOOGLE_CSE_API_KEY, then restart the app. See Admin → Integrations."
                : "Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID. See Admin → Integrations."
            }
          />
        ) : loading ? (
          <p className="text-sm text-muted-foreground py-8">Loading LinkedIn matches…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="No LinkedIn matches yet"
            description={query ? "No public profiles matched this X-Ray query." : "Click Refresh Matches to search public LinkedIn profiles with this job’s Boolean."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Candidate</th>
                  <th className="py-2 pr-3 font-medium">Current Role</th>
                  <th className="py-2 pr-3 font-medium">Experience</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Education</th>
                  <th className="py-2 pr-3 font-medium">Match Score</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        {row.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-brand-700/10 text-brand-700 text-xs font-semibold flex items-center justify-center">
                            {getInitials(row.fullName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {row.fullName}{" "}
                            <a
                              href={row.linkedInUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-semibold text-sky-700 align-middle"
                            >
                              in
                            </a>
                          </div>
                          <a
                            href={row.linkedInUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:underline truncate block"
                          >
                            {linkedInPath(row.linkedInUrl)}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div>{row.currentTitle || "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.currentCompany || "—"}</div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">{experienceLabel(row.experienceYears)}</td>
                    <td className="py-3 pr-3">{row.location || "—"}</td>
                    <td className="py-3 pr-3">{row.education || "—"}</td>
                    <td className="py-3 pr-3">
                      <LinkedInMatchScore score={row.matchScore} label={row.matchLabel} />
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <a href={row.linkedInUrl} target="_blank" rel="noreferrer">View Profile</a>
                        </Button>
                        <Button
                          size="sm"
                          disabled={importingId === row.id}
                          onClick={() => void importRows([row.id])}
                        >
                          {importingId === row.id ? "Importing…" : "Import"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
              <span>
                Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of {total} results
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
        {error ? <p className="text-destructive text-xs mt-3">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
