import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listAuditLogs, getOrgMembers } from "@/lib/services/analytics-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActivityTimestamp } from "@/components/shared/activity-timestamp";

export default async function SystemLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entityType?: string;
    actorId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const filters = await searchParams;
  const [logs, members] = await Promise.all([
    listAuditLogs(member.organizationId, filters),
    getOrgMembers(member.organizationId),
  ]);

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Logs" description="Audit trail with filters for action, entity, user, and date range." />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <Input id="action" name="action" defaultValue={filters.action ?? ""} placeholder="email.sent" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="entityType">Entity</Label>
              <Input id="entityType" name="entityType" defaultValue={filters.entityType ?? ""} placeholder="Job" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="actorId">User</Label>
              <select
                id="actorId"
                name="actorId"
                defaultValue={filters.actorId ?? ""}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              >
                <option value="">All users</option>
                {members.map((entry) => (
                  <option key={entry.user.id} value={entry.user.id}>
                    {entry.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className="mt-1" />
            </div>
            <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
              <Button type="submit" size="sm">Apply filters</Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href="/admin/logs">Clear</Link>
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No log entries match these filters.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between border-b pb-2 text-sm gap-4">
                  <div className="min-w-0">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground ml-2">{log.entityType}</span>
                    {log.entityId ? (
                      <span className="text-muted-foreground ml-2 font-mono text-xs">{log.entityId.slice(0, 8)}</span>
                    ) : null}
                    {log.actor ? <span className="text-muted-foreground ml-2">by {log.actor.name}</span> : null}
                  </div>
                  <ActivityTimestamp createdAt={log.createdAt} className="text-xs text-muted-foreground whitespace-nowrap" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
