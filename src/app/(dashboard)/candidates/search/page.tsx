import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { searchCandidates } from "@/lib/services/candidate-search-service";
import { listJobsForSourcing } from "@/lib/services/job-service";
import { listSavedViews } from "@/lib/services/saved-view-service";
import type { CandidateSearchMode } from "@/lib/services/search-utils";
import { formatCandidateSource } from "@/lib/services/candidate-service";
import { parseCandidateSearchFilters, filtersToSearchParams } from "@/lib/search/candidate-filters";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { CandidateSearchPanel } from "@/components/candidates/candidate-search-panel";
import { AdvancedSearchFilters } from "@/components/candidates/advanced-search-filters";
import { SavedTalentSearchBar } from "@/components/candidates/saved-talent-search-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { previewHref } from "@/lib/preview-href";
import { getCandidateSearchFacets } from "@/lib/search/search-facets";
import { withPagePerf } from "@/lib/perf";
import { RegisterCandidateNav } from "@/components/candidates/register-candidate-nav";
import { RegisterRecentTalentSearch } from "@/components/candidates/register-recent-talent-search";

const PAGE_SIZE = 50;

function parseSearchMode(value?: string | null, jobId?: string): CandidateSearchMode {
  if (value === "skill" || value === "boolean" || value === "all" || value === "name") return value;
  return jobId ? "boolean" : "name";
}

export default async function CandidateSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const params = await searchParams;
  const filters = parseCandidateSearchFilters(params);
  const jobId = filters.jobId;
  const mode = parseSearchMode(params.mode, jobId);
  const [savedSearches, facets, sourcingJobs] = await Promise.all([
    listSavedViews(member.organizationId, session.user.id, "TALENT_SEARCH"),
    getCandidateSearchFacets(member.organizationId),
    listJobsForSourcing(member.organizationId, jobId),
  ]);
  const selectedJob = jobId ? sourcingJobs.find((job) => job.id === jobId) : undefined;
  const query = filters.query ?? selectedJob?.booleanSearch?.trim() ?? "";
  const resolvedFilters = { ...filters, query: query || undefined, mode, jobId };
  const hasSearch = Boolean(
    query ||
      filters.skills?.length ||
      filters.location ||
      filters.city ||
      filters.country ||
      filters.company ||
      filters.minExperience !== undefined ||
      filters.workAuthorization ||
      filters.education,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Talent Search"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/candidates/hotlists">Hotlists</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/candidates">Back to database</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Suspense fallback={null}>
            <CandidateSearchPanel
              key={`${jobId ?? ""}:${mode}:${query}`}
              jobs={sourcingJobs}
              userId={session.user.id}
              initialQuery={query}
              initialMode={mode}
              initialJobId={jobId ?? ""}
            />
          </Suspense>
          <Suspense fallback={null}>
            <AdvancedSearchFilters initialFilters={resolvedFilters} mode={mode} facets={facets} />
          </Suspense>
          <SavedTalentSearchBar
            savedSearches={savedSearches.map((view) => ({
              id: view.id,
              name: view.name,
              filters: view.filters as Record<string, string>,
            }))}
            currentFilters={filtersToSearchParams(resolvedFilters)}
          />
        </CardContent>
      </Card>

      {hasSearch ? (
        <SearchResults
          organizationId={member.organizationId}
          userId={session.user.id}
          filters={resolvedFilters}
          cursor={params.cursor}
          sourcingJobLabel={selectedJob ? `${selectedJob.jobCode} · ${selectedJob.title}` : undefined}
        />
      ) : null}
    </div>
  );
}

async function SearchResults({
  organizationId,
  userId,
  filters,
  cursor,
  sourcingJobLabel,
}: {
  organizationId: string;
  userId: string;
  filters: ReturnType<typeof parseCandidateSearchFilters> & { mode: CandidateSearchMode };
  cursor?: string;
  sourcingJobLabel?: string;
}) {
  let results;
  let error: string | null = null;

  try {
    results = await withPagePerf("candidates.search", () =>
      searchCandidates(organizationId, {
        filters,
        limit: PAGE_SIZE,
        cursor,
      }),
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Search failed";
    results = { items: [], nextCursor: undefined, total: 0 };
  }

  const searchParams = filtersToSearchParams(filters);
  const listQuery = new URLSearchParams(searchParams);
  if (cursor) listQuery.set("cursor", cursor);
  const returnTo = `/candidates/search?${listQuery.toString()}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          {results.total} result{results.total === 1 ? "" : "s"} · {filters.mode} search
          {sourcingJobLabel ? ` · ${sourcingJobLabel}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <RegisterRecentTalentSearch
          userId={userId}
          filters={filters}
          sourcingJobLabel={sourcingJobLabel}
          cursor={cursor}
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : results.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidates matched this search.</p>
        ) : (
          <>
            <RegisterCandidateNav
              ids={results.items.map((candidate) => candidate.id)}
              returnTo={returnTo}
              append={Boolean(cursor)}
            />
            {results.items.map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/40"
              >
                <Link href={`/candidates/${candidate.id}`} className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-brand-700 hover:underline">
                    {candidate.firstName} {candidate.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      candidate.currentRole ?? candidate.currentTitle,
                      candidate.currentCompany,
                      candidate.email,
                      candidate.location ?? [candidate.city, candidate.country].filter(Boolean).join(", "),
                      formatCandidateSource(candidate.source),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </Link>
                <Button size="sm" variant="outline" asChild>
                  <Link href={previewHref("candidate", candidate.id, "/candidates/search")}>Preview</Link>
                </Button>
              </div>
            ))}
            <CursorPagination
              nextCursor={results.nextCursor}
              basePath="/candidates/search"
              searchParams={{ ...searchParams, cursor }}
              pageSize={PAGE_SIZE}
              shown={results.items.length}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
