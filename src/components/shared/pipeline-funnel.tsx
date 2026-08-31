import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import Link from "next/link";
import { PIPELINE_STAGES } from "@/lib/constants/pipeline";
import { ActivityTimestamp } from "@/components/shared/activity-timestamp";

const STAGE_HREFS: Record<string, string> = {
  NOT_APPLIED: "/candidates",
  APPLYING: "/jobs",
  INTERVIEW_COMPLETED: "/jobs",
  MCC: "/jobs",
  CERTIFIED: "/jobs",
  MATCHED_TO_PROJECT: "/jobs",
  PLACEMENT: "/jobs?view=closed",
};

const STAGE_COLORS = [
  "bg-zinc-300", "bg-brand-300", "bg-brand-500", "bg-brand-700",
  "bg-teal-600", "bg-teal-700", "bg-brand-900",
];

export function PipelineFunnel({
  data,
}: {
  data: Array<{ stage: string; count: number }>;
}) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          <Link href="/jobs" className="hover:text-brand-700 hover:underline">
            Pipeline Overview
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-32">
          {PIPELINE_STAGES.map((stage, i) => {
            const item = data.find((d) => d.stage === stage.key);
            const count = item?.count ?? 0;
            const height = Math.max(8, (count / total) * 100);
            const prev = i > 0 ? (data.find((d) => d.stage === PIPELINE_STAGES[i - 1].key)?.count ?? 0) : count;
            const conversion = prev > 0 ? Math.round((count / prev) * 100) : 0;
            const href = STAGE_HREFS[stage.key] ?? "/jobs";
            return (
              <Link
                key={stage.key}
                href={href}
                className="flex-1 flex flex-col items-center gap-1 rounded-md px-0.5 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                aria-label={`${stage.label}: ${count.toLocaleString()}`}
              >
                <span className="text-xs font-semibold">{count.toLocaleString()}</span>
                <div
                  className={`w-full rounded-t-md ${STAGE_COLORS[i]}`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[9px] text-muted-foreground text-center leading-tight">{stage.label}</span>
                {i > 0 && (
                  <span className="text-[9px] text-brand-700">{conversion}%</span>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityFeed({
  activities,
}: {
  activities: Array<{
    id: string;
    action: string;
    detail: string;
    meta?: string;
    createdAt: Date;
    href?: string;
    actionLabel?: string;
  }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Recent Activity</CardTitle>
        <Link href="/activity" className="text-[10px] text-brand-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity</p>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3">
              <Avatar name={a.meta ?? "System"} size="sm" />
              <div className="min-w-0">
                <p className="text-xs">
                  {a.href ? (
                    <Link href={a.href} className="font-medium text-brand-700 hover:underline">
                      {a.detail}
                    </Link>
                  ) : (
                    <span className="font-medium">{a.detail}</span>
                  )}
                  {" · "}
                  <span className="text-muted-foreground">
                    {(a.actionLabel ?? a.action).replace(/\./g, " ")}
                  </span>
                </p>
                {a.meta ? <p className="text-[10px] font-mono text-muted-foreground">{a.meta}</p> : null}
                <ActivityTimestamp createdAt={a.createdAt} className="text-[10px] text-muted-foreground mt-0.5" />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
