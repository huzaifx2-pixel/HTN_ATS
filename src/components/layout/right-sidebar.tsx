import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CountdownBadge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body?: string | null;
  createdAt: Date;
}

export function RightSidebar({
  notifications = [],
  interviews = [],
  urgentJobs = [],
}: {
  notifications?: Notification[];
  interviews?: Array<{ time: string; name: string; job: string }>;
  urgentJobs?: Array<{ title: string; jobCode: string; daysLeft: number }>;
}) {
  return (
    <aside className="hidden xl:flex w-80 flex-col gap-4 border-l border-border bg-card p-4 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground">No new notifications</p>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="text-xs">
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-muted-foreground mt-0.5">{n.body}</div>}
                <div className="text-muted-foreground mt-1">
                  {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Today&apos;s Interviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {interviews.length === 0 ? (
            <p className="text-xs text-muted-foreground">No interviews scheduled</p>
          ) : (
            interviews.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="text-xs font-mono text-brand-700 w-16">{i.time}</div>
                <Avatar name={i.name} size="sm" />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{i.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{i.job}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Jobs Needing Attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {urgentJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">All jobs on track</p>
          ) : (
            urgentJobs.map((j, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{j.title}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{j.jobCode}</div>
                </div>
                <CountdownBadge days={j.daysLeft} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
