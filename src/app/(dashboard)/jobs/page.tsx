import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listJobs, countJobsByStatus, countJobsMissingBoolean } from "@/lib/services/job-service";
import { getOrgMembers } from "@/lib/services/analytics-service";
import { attachJobMatchEmailStats } from "@/lib/services/match-email-outreach-service";
import { listSavedViews } from "@/lib/services/saved-view-service";
import { withPagePerf } from "@/lib/perf";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { CompactJobTable } from "@/components/shared/job-table";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { SavedViewsBar, SavedViewsList } from "@/components/shared/saved-views-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Upload } from "lucide-react";
import { RegenerateAllBooleansButton } from "@/components/jobs/regenerate-all-booleans-button";

type JobsView = "open" | "on_hold" | "closed";
const PAGE_SIZE = 50;

function parseJobsView(value?: string | null): JobsView {
  if (value === "closed" || value === "on_hold") return value;
  return "open";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; cursor?: string; search?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { view: rawView, cursor, search } = await searchParams;
  const view = parseJobsView(rawView);
  const status = view === "closed" ? "CLOSED" : view === "on_hold" ? "ON_HOLD" : "OPEN";

  const { nextCursor, jobCounts, savedViews, missingBooleanCount, jobs, members } =
    await withPagePerf("jobs", async () => {
      const [listed, counts, views, missing, orgMembers] = await Promise.all([
        listJobs(member.organizationId, { status, limit: PAGE_SIZE, cursor, search }),
        countJobsByStatus(member.organizationId),
        listSavedViews(member.organizationId, session.user.id, "JOBS"),
        countJobsMissingBoolean(member.organizationId),
        getOrgMembers(member.organizationId),
      ]);
      const withStats = await attachJobMatchEmailStats(member.organizationId, listed.items);
      return {
        nextCursor: listed.nextCursor,
        jobCounts: counts,
        savedViews: views,
        missingBooleanCount: missing,
        jobs: withStats,
        members: orgMembers,
      };
    });
  const openCount = jobCounts.open;
  const onHoldCount = jobCounts.onHold;
  const closedCount = jobCounts.closed;
  const total = view === "open" ? openCount : view === "on_hold" ? onHoldCount : closedCount;
  const formatTabCount = (value: { count: number; capped?: boolean }) => {
    return `${value.count.toLocaleString()}${value.capped ? "+" : ""}`;
  };

  const tabLinks: Array<{ view: JobsView; label: string; count: string }> = [
    { view: "open", label: "Open", count: formatTabCount(openCount) },
    { view: "on_hold", label: "On hold", count: formatTabCount(onHoldCount) },
    { view: "closed", label: "Closed", count: formatTabCount(closedCount) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description={
          view === "open"
            ? `${formatTabCount(openCount)} open role${openCount.count === 1 && !openCount.capped ? "" : "s"}`
            : view === "on_hold"
              ? `${formatTabCount(onHoldCount)} on hold`
              : `${formatTabCount(closedCount)} closed role${closedCount.count === 1 && !closedCount.capped ? "" : "s"}`
        }
        actions={
          <>
            <RegenerateAllBooleansButton missingCount={missingBooleanCount} />
            <Button variant="outline" asChild>
              <Link href="/jobs/import">
                <Upload className="h-4 w-4" /> Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/jobs/create">
                <Plus className="h-4 w-4" /> Create Job
              </Link>
            </Button>
          </>
        }
      />

      <SavedViewsBar entityType="JOBS" currentFilters={{ view, search, cursor }} />
      <SavedViewsList
        basePath="/jobs"
        views={savedViews.map((viewItem) => ({
          id: viewItem.id,
          name: viewItem.name,
          filters: viewItem.filters as Record<string, string>,
        }))}
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {tabLinks.map((tab) => (
          <Link
            key={tab.view}
            href={`/jobs?view=${tab.view}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === tab.view
                ? "bg-brand-700 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </div>

      <CompactJobTable
        jobs={jobs}
        view={view === "closed" ? "closed" : "open"}
        emptyMessage={
          view === "open" ? "No open jobs" : view === "on_hold" ? "No jobs on hold" : "No closed jobs"
        }
        canDelete={member.role === "OWNER" || member.role === "ADMIN"}
        assignees={members.map((entry) => ({ id: entry.user.id, name: entry.user.name }))}
      />
      <CursorPagination
        nextCursor={nextCursor}
        basePath="/jobs"
        searchParams={{ view, search, cursor }}
        pageSize={PAGE_SIZE}
        total={search ? undefined : (typeof total === "object" && "count" in total ? total.count : total)}
        totalCapped={search ? undefined : (typeof total === "object" && "capped" in total ? total.capped : false)}
        shown={jobs.length}
      />
    </div>
  );
}
