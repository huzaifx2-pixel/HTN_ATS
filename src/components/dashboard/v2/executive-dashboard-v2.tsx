import { ExecutiveHeader } from "@/components/dashboard/v2/executive-header";
import { KpiRow } from "@/components/dashboard/v2/kpi-row";
import { NeedsAttention } from "@/components/dashboard/v2/needs-attention";
import { AnalysisRow, FunnelChart } from "@/components/dashboard/v2/analysis-row";
import { ActivityTasksRow, RecentActivityCard } from "@/components/dashboard/v2/activity-tasks-row";
import type { ExecutiveDashboardPreviewData } from "@/lib/services/executive-dashboard-preview";

export function ExecutiveDashboardV2({ data }: { data: ExecutiveDashboardPreviewData }) {
  return (
    <div className="space-y-5">
      <ExecutiveHeader firstName={data.meta.userFirstName} quote={data.meta.quote} />

      <KpiRow kpis={data.kpis} />

      <NeedsAttention items={data.attention} />

      <AnalysisRow
        jobHealth={data.jobHealth}
        recruiters={data.recruiters}
      />

      <ActivityTasksRow
        jobActivity={data.jobActivity}
        tasks={data.tasks}
      />

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FunnelChart stages={data.funnel.stages} />
        </div>
        <RecentActivityCard items={data.recentActivity} />
      </div>
    </div>
  );
}
