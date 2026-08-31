import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";
import { getPagePerfStats, getTopSlowQueries, getWatchedQueryStats } from "@/lib/perf";

export async function GET() {
  try {
    await requirePermission("view_analytics");
    const { getDatabaseConnectionStats } = await import("@/lib/db/count");
    const [connections] = await Promise.all([getDatabaseConnectionStats()]);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sampleWindow: "since process start",
      slowMs: Number(process.env.PERF_SLOW_MS ?? 50),
      connections,
      flags: {
        idleInTransaction: {
          value: connections.idleInTransaction,
          healthy: connections.idleInTransaction <= 2,
          note: "0 is healthy; 1-2 is acceptable; 10+ or steadily growing is bad",
        },
      },
      targetsMs: {
        dashboardMetrics: 100,
        candidateSearch: 200,
        candidateProfile: 150,
        jobsList: 100,
        cachedCounts: 20,
        pageRender: 300,
      },
      watched: getWatchedQueryStats(),
      top10: getTopSlowQueries(),
      pages: getPagePerfStats(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
