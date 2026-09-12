import Link from "next/link";
import { BarChart3, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type {
  PreviewFunnelStage,
  PreviewJobHealthBucket,
  PreviewRecruiter,
} from "@/lib/services/executive-dashboard-preview";

const STAGE_BAR_COLORS = [
  "#3b82f6", // Applying
  "#2563eb", // AI interview
  "#14b8a6", // MCC Met
  "#34d399", // Certified
  "#a78bfa", // Matched
  "#8b5cf6", // Hired
  "#fbbf24", // Reward assigned
  "#f59e0b", // Payment released
  "#fb7185", // Payment sent
  "#f472b6", // Paid
  "#94a3b8", // Existing micro1 user
  "#f87171", // Invalid
];

export function FunnelChart({ stages }: { stages: PreviewFunnelStage[] }) {
  const baseline = Math.max(stages[0]?.count ?? 0, 1);
  const max = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe]">
            <BarChart3 className="h-4 w-4 text-[#2563eb]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0f172a]">Recruitment Funnel</h3>
            <p className="text-xs text-muted-foreground">From talent pool to placement</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-[#0f172a]"
          >
            Count
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <Link href="/referrals" className="text-xs font-medium text-[#2563eb] hover:underline">
            View pipeline
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const shareOfTop = Math.round((stage.count / baseline) * 1000) / 10;
          const barPct = max > 0 ? Math.max(stage.count > 0 ? 4 : 0, (stage.count / max) * 100) : 0;
          const color = STAGE_BAR_COLORS[index % STAGE_BAR_COLORS.length];

          return (
            <div
              key={stage.key}
              className="grid items-center gap-x-4"
              style={{
                gridTemplateColumns: "minmax(9.5rem, 13rem) 3.75rem minmax(0, 1fr) 2.75rem",
              }}
            >
              <div className="truncate text-[13px] font-medium text-[#1e293b]">{stage.label}</div>
              <div className="text-right text-[13px] font-semibold tabular-nums text-[#0f172a]">
                {stage.count.toLocaleString()}
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e8eef5]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: color }}
                />
              </div>
              <div className="text-right text-[13px] tabular-nums text-[#94a3b8]">
                {Number.isInteger(shareOfTop) ? shareOfTop : shareOfTop.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobHealthDonut({
  totalOpen,
  buckets,
  mock,
}: {
  totalOpen: number;
  buckets: PreviewJobHealthBucket[];
  mock: boolean;
}) {
  const visible = buckets.filter((b) => b.key !== "closed" || b.count > 0);
  const total = visible.reduce((sum, b) => sum + b.count, 0) || 1;
  const radius = 54;
  const stroke = 16;
  const c = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0f172a]">Job Health</h3>
        {mock ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            Preview rules
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-start sm:gap-6">
        <div className="relative h-[140px] w-[140px] shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
            {visible.map((bucket) => {
              const len = (bucket.count / total) * c;
              const dash = `${len} ${c - len}`;
              const el = (
                <circle
                  key={bucket.key}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={bucket.color}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums text-[#0f172a]">
              {totalOpen.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">Open Jobs</span>
          </div>
        </div>
        <ul className="w-full max-w-[220px] space-y-2.5">
          {visible.map((bucket) => (
            <li key={bucket.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: bucket.color }}
                />
                <span className="truncate">{bucket.label}</span>
              </span>
              <span className="text-right font-medium tabular-nums text-[#0f172a]">
                {bucket.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RecruiterPerformance({ recruiters }: { recruiters: PreviewRecruiter[] }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-[#0f172a]">
          Top Performing Recruiters
        </h3>
        <Link
          href="/analytics/recruiters"
          className="shrink-0 text-xs text-[#2563eb] hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {recruiters.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recruiter data yet</p>
        ) : (
          recruiters.map((recruiter, index) => (
            <Link
              key={recruiter.id}
              href="/analytics/recruiters"
              className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-muted/50"
            >
              <span className="w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
              <Avatar name={recruiter.name} size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#0f172a]">{recruiter.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {recruiter.jobsOwned} jobs · {recruiter.submissions} pipeline moves
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-[#0f172a]">{recruiter.score}</div>
                <div className="text-[10px] text-muted-foreground">
                  {recruiter.mockScore ? "score preview" : "score"}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export function AnalysisRow({
  jobHealth,
  recruiters,
}: {
  jobHealth: { totalOpen: number; buckets: PreviewJobHealthBucket[]; mock: boolean };
  recruiters: PreviewRecruiter[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <JobHealthDonut
        totalOpen={jobHealth.totalOpen}
        buckets={jobHealth.buckets}
        mock={jobHealth.mock}
      />
      <RecruiterPerformance recruiters={recruiters} />
    </div>
  );
}
