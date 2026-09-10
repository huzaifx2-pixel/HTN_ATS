"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchMatchingJobsAction } from "@/app/actions";
import { MatchingHubEmail } from "@/components/matching/matching-hub-email";
import { MatchingRematchButton } from "@/components/matching/matching-rematch-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { formatJobLocation, formatJobSalary, getJobSalaryFields, resolveJobDisplayDate } from "@/lib/format-job";
import { cn, formatJobTimestamp, getJobReferralUrl } from "@/lib/utils";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import type { MatchingJobRow } from "@/lib/services/match-email-outreach-service";

type EmailTemplate = { id: string; name: string; subject: string; body: string };

function MatchingJobsSearch({ search = "" }: { search?: string }) {
  return (
    <form action={searchMatchingJobsAction} className="flex w-full max-w-xs items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search job ID, title, or client"
          aria-label="Search matching jobs"
          className="flex h-8 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <button
        type="submit"
        className="h-8 shrink-0 rounded-lg border border-input bg-card px-2.5 text-xs font-medium hover:bg-muted"
      >
        Search
      </button>
    </form>
  );
}

export function MatchingJobsTable({
  jobs,
  totalJobs,
  nextCursor = null,
  cursor,
  search,
  pageSize = 50,
  templates,
  gmailConnected,
  userEmail,
  recruiterName,
  matchingKilled = false,
}: {
  jobs: MatchingJobRow[];
  totalJobs?: number;
  nextCursor?: string | null;
  cursor?: string;
  search?: string;
  pageSize?: number;
  templates: EmailTemplate[];
  gmailConnected: boolean;
  userEmail?: string;
  recruiterName: string;
  matchingKilled?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedJobs = useMemo(() => jobs.filter((job) => selected.has(job.id)), [jobs, selected]);
  const selectedIds = useMemo(() => selectedJobs.map((job) => job.id), [selectedJobs]);
  const pendingCount = selectedJobs.reduce((sum, job) => sum + job.emailStats.emailsPending, 0);
  const followUpCount = selectedJobs.reduce((sum, job) => sum + job.followUpCount, 0);
  const singleJob = selectedJobs.length === 1 ? selectedJobs[0] : undefined;
  const allSelected = selected.size === jobs.length && jobs.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(jobs.map((job) => job.id)));
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader className="gap-3 space-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm">Jobs with matching candidates</CardTitle>
            <MatchingJobsSearch key={search ?? ""} search={search} />
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <EmptyState
            title={
              search
                ? `No jobs match “${search}”`
                : cursor
                  ? "No more matching jobs"
                  : "No matching candidates yet"
            }
            description={
              search
                ? "Try a job ID, title, or client name."
                : cursor
                  ? "This page is empty. Go back to the first page to see jobs with matches."
                  : "Open jobs with a Boolean search will appear here once candidates match that Boolean."
            }
          />
        </CardContent>
        {cursor || search ? (
          <CursorPagination
            nextCursor={null}
            basePath="/matching"
            searchParams={{ cursor, search }}
            pageSize={pageSize}
            total={totalJobs}
            shown={0}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 space-y-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm">
              Jobs with matching candidates ({jobs.length}
              {totalJobs != null && totalJobs > jobs.length ? ` of ${totalJobs}` : ""})
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Select jobs to email those matches only. Row buttons still send for a single job.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MatchingJobsSearch key={search ?? ""} search={search} />
            <MatchingHubEmail
              key={`outreach-${selectedIds.join("|") || "none"}`}
              mode="outreach"
              jobId={singleJob?.id}
              jobIds={selectedIds}
              remainingCount={pendingCount}
              jobTitle={singleJob?.title}
              jobCode={singleJob?.jobCode}
              clientName={singleJob?.client.name}
              jobLocation={singleJob ? formatJobLocation(singleJob) : undefined}
              jobSalary={singleJob ? formatJobSalary(getJobSalaryFields(singleJob)) : undefined}
              applyLink={singleJob ? getJobReferralUrl(singleJob) : undefined}
              recruiterName={recruiterName}
              templates={templates}
              gmailConnected={gmailConnected}
              userEmail={userEmail}
              triggerLabel={`Email selected${selectedIds.length > 0 ? ` (${pendingCount.toLocaleString()})` : ""}`}
              triggerSize="sm"
            />
            <MatchingHubEmail
              key={`followup-${selectedIds.join("|") || "none"}`}
              mode="followup"
              jobId={singleJob?.id}
              jobIds={selectedIds}
              remainingCount={followUpCount}
              jobTitle={singleJob?.title}
              jobCode={singleJob?.jobCode}
              clientName={singleJob?.client.name}
              jobLocation={singleJob ? formatJobLocation(singleJob) : undefined}
              jobSalary={singleJob ? formatJobSalary(getJobSalaryFields(singleJob)) : undefined}
              applyLink={singleJob ? getJobReferralUrl(singleJob) : undefined}
              recruiterName={recruiterName}
              templates={templates}
              gmailConnected={gmailConnected}
              userEmail={userEmail}
              triggerLabel={`Follow up selected${selectedIds.length > 0 ? ` (${followUpCount.toLocaleString()})` : ""}`}
              triggerVariant="outline"
              triggerSize="sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {selectedIds.length > 0 ? (
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            {selectedIds.length} job{selectedIds.length === 1 ? "" : "s"} selected · {pendingCount.toLocaleString()}{" "}
            remaining to email · {followUpCount.toLocaleString()} follow-up
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all jobs on this page"
                  />
                </th>
                <th className="px-4 py-2 text-left font-medium">Job ID</th>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-left font-medium">Location</th>
                <th className="px-4 py-2 text-right font-medium">Matches</th>
                <th className="px-4 py-2 text-right font-medium">Not sent</th>
                <th className="px-4 py-2 text-right font-medium">Follow-up</th>
                <th className="px-4 py-2 text-left font-medium">Posted</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/30",
                    selected.has(job.id) && "bg-brand-50/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(job.id)}
                      onChange={() => toggle(job.id)}
                      aria-label={`Select ${job.title}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-mono text-brand-700 hover:underline">
                      {job.jobCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}?tab=matching`} className="font-medium text-brand-700 hover:underline">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{job.client.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatJobLocation(job)}</td>
                  <td className="px-4 py-3 text-right">{job.emailStats.totalMatches}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={job.emailStats.emailsPending > 0 ? "font-medium text-amber-700" : "text-muted-foreground"}>
                      {job.emailStats.emailsPending}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{job.followUpCount}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                    {formatJobTimestamp(resolveJobDisplayDate(job))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <MatchingRematchButton
                        jobId={job.id}
                        jobTitle={job.title}
                        killed={matchingKilled}
                      />
                      <MatchingHubEmail
                        mode="outreach"
                        jobId={job.id}
                        remainingCount={job.emailStats.emailsPending}
                        jobTitle={job.title}
                        jobCode={job.jobCode}
                        clientName={job.client.name}
                        jobLocation={formatJobLocation(job)}
                        jobSalary={formatJobSalary(getJobSalaryFields(job))}
                        applyLink={getJobReferralUrl(job)}
                        recruiterName={recruiterName}
                        templates={templates}
                        gmailConnected={gmailConnected}
                        userEmail={userEmail}
                        triggerSize="sm"
                      />
                      <MatchingHubEmail
                        mode="followup"
                        jobId={job.id}
                        remainingCount={job.followUpCount}
                        jobTitle={job.title}
                        jobCode={job.jobCode}
                        clientName={job.client.name}
                        jobLocation={formatJobLocation(job)}
                        jobSalary={formatJobSalary(getJobSalaryFields(job))}
                        applyLink={getJobReferralUrl(job)}
                        recruiterName={recruiterName}
                        templates={templates}
                        gmailConnected={gmailConnected}
                        userEmail={userEmail}
                        triggerVariant="outline"
                        triggerSize="sm"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CursorPagination
        nextCursor={nextCursor}
        basePath="/matching"
        searchParams={{ cursor, search }}
        pageSize={pageSize}
        total={totalJobs}
        shown={jobs.length}
      />
    </Card>
  );
}
