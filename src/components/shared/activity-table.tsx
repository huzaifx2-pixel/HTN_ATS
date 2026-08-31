import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityRow } from "@/lib/activity/types";
import { ActivityTimestamp } from "@/components/shared/activity-timestamp";

export function ActivityTable({
  activities,
  title = "Activity",
  emptyMessage = "No activity yet",
}: {
  activities: ActivityRow[];
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Time</th>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Action</th>
                  <th className="px-4 py-2 text-left font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <ActivityTimestamp createdAt={activity.createdAt} className="text-muted-foreground" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      {activity.actorHref ? (
                        <Link href={activity.actorHref} className="text-brand-700 hover:underline">
                          {activity.actorName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{activity.actorName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top font-medium">{activity.actionLabel}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        {activity.entityHref ? (
                          <Link href={activity.entityHref} className="text-brand-700 hover:underline font-medium">
                            {activity.entityLabel}
                          </Link>
                        ) : (
                          <span className="font-medium">{activity.entityLabel}</span>
                        )}
                        {activity.secondaryLabel ? (
                          activity.secondaryHref ? (
                            <div>
                              <Link href={activity.secondaryHref} className="text-muted-foreground hover:underline">
                                {activity.secondaryLabel}
                              </Link>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">{activity.secondaryLabel}</div>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
