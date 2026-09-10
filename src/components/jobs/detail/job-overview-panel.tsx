import Link from "next/link";
import {
  Briefcase,
  Building2,
  Calendar,
  Hash,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobDescriptionView } from "@/components/jobs/job-description-view";
import { formatActivityAction } from "@/lib/activity/format";
import { cn } from "@/lib/utils";

export type JobOverviewCandidateStats = {
  total: number;
  inReview: number;
  shortlisted: number;
  hired: number;
};

export type JobOverviewMatchStats = {
  total: number;
  high: number;
  medium: number;
  low: number;
  goodMatchPercent: number;
};

export type JobOverviewDetail = {
  jobId: string;
  department: string;
  experienceLevel: string;
  salaryRange: string;
  employmentType: string;
  location: string;
  openings: number;
  postedOn: string;
};

export type JobOverviewActivity = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
  actor?: { name: string } | null;
};

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium text-foreground">{value || "—"}</div>
      </div>
    </div>
  );
}

function MatchDonut({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/40" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-sky-500 transition-[stroke-dashoffset]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-xl font-semibold tabular-nums">{clamped}%</div>
        <div className="text-[10px] text-muted-foreground">Good Match</div>
      </div>
    </div>
  );
}

function activityDotClass(action: string) {
  if (action.includes("published") || action.includes("created") || action.includes("reopened") || action.includes("imported")) {
    return "bg-emerald-500";
  }
  if (action.includes("closed") || action.includes("removed")) {
    return "bg-slate-400";
  }
  if (action.includes("updated")) {
    return "bg-slate-400";
  }
  return "bg-sky-500";
}

export function JobOverviewPanel({
  jobId,
  details,
  description,
  responsibilities,
  requirementsText,
  preferredQualifications,
  skills,
  candidates,
  matches,
  activities,
}: {
  jobId: string;
  details: JobOverviewDetail;
  description?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
  preferredQualifications?: string | null;
  skills?: string[];
  candidates: JobOverviewCandidateStats;
  matches: JobOverviewMatchStats;
  activities: JobOverviewActivity[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem icon={Hash} label="Job ID" value={details.jobId} />
              <DetailItem icon={Building2} label="Department" value={details.department} />
              <DetailItem icon={Briefcase} label="Experience Level" value={details.experienceLevel} />
              <DetailItem icon={Users} label="Salary Range" value={details.salaryRange} />
              <DetailItem icon={Briefcase} label="Employment Type" value={details.employmentType} />
              <DetailItem icon={MapPin} label="Location" value={details.location} />
              <DetailItem icon={Users} label="Openings" value={String(details.openings)} />
              <DetailItem icon={Calendar} label="Posted On" value={details.postedOn} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Job Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-foreground/90">
            {description?.trim() ? (
              <p className="whitespace-pre-wrap">{description}</p>
            ) : null}
            <JobDescriptionView
              description={null}
              responsibilities={responsibilities}
              requirementsText={requirementsText}
              preferredQualifications={preferredQualifications}
              skills={skills}
            />
            {!description?.trim() &&
              !responsibilities?.trim() &&
              !requirementsText?.trim() &&
              !preferredQualifications?.trim() &&
              !(skills && skills.length > 0) && (
                <p className="text-muted-foreground">No description has been added for this job yet.</p>
              )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Candidates</CardTitle>
            <Link href={`/jobs/${jobId}?tab=applicants`} className="text-xs font-medium text-sky-700 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{candidates.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-sky-600">{candidates.inReview}</div>
                <div className="text-xs text-muted-foreground">In Review</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-amber-600">{candidates.shortlisted}</div>
                <div className="text-xs text-muted-foreground">Shortlisted</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">{candidates.hired}</div>
                <div className="text-xs text-muted-foreground">Hired</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Match Insights</CardTitle>
            <Link href={`/jobs/${jobId}?tab=matching`} className="text-xs font-medium text-sky-700 hover:underline">
              View matching
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <MatchDonut percent={matches.goodMatchPercent} />
              <div className="min-w-0 space-y-2 text-xs">
                <div>
                  <div className="text-lg font-semibold tabular-nums">{matches.total}</div>
                  <div className="text-muted-foreground">Total Matches</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">High Match</span>
                    <span className="ml-auto font-medium tabular-nums">{matches.high}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-muted-foreground">Medium</span>
                    <span className="ml-auto font-medium tabular-nums">{matches.medium}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-muted-foreground">Low</span>
                    <span className="ml-auto font-medium tabular-nums">{matches.low}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <Link href={`/jobs/${jobId}?tab=activity`} className="text-xs font-medium text-sky-700 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-4">
                {activities.slice(0, 8).map((activity, index) => (
                  <li key={activity.id} className="relative flex gap-3 pl-1">
                    {index < Math.min(activities.length, 8) - 1 ? (
                      <span className="absolute left-[7px] top-4 h-[calc(100%+8px)] w-px bg-border" aria-hidden />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        activityDotClass(activity.action),
                      )}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-snug">
                        {activity.actor?.name ? `${activity.actor.name} · ` : ""}
                        {formatActivityAction(activity.action, activity.metadata)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {activity.createdAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
