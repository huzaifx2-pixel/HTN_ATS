import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getJobAnalytics } from "@/lib/services/job-analytics-service";

type JobAnalytics = NonNullable<Awaited<ReturnType<typeof getJobAnalytics>>>;

export function JobAnalyticsPanel({ analytics }: { analytics: JobAnalytics }) {
  const stats = [
    { label: "Total applicants", value: analytics.totalApplicants },
    { label: "Submissions", value: analytics.submissions },
    { label: "Interviews+", value: analytics.interviews },
    { label: "Placements", value: analytics.placements },
    { label: "AI matches", value: analytics.matches },
    { label: "Emails sent", value: analytics.emailsSent },
    { label: "Conversion", value: `${analytics.conversionRate}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-semibold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {analytics.pipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applicants in pipeline yet.</p>
          ) : (
            analytics.pipeline.map((row) => (
              <div key={row.stage} className="flex items-center justify-between text-sm">
                <span>{row.stage.replace(/_/g, " ")}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
