import { NextRequest, NextResponse } from "next/server";
import { syncWebsiteJobsForAllOrganizations } from "@/lib/services/website-job-sync-service";
import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";
import { apiErrorResponse } from "@/lib/api-error";

registerWorker("website-job-sync", true);
function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runWorker("website-job-sync", () =>
      syncWebsiteJobsForAllOrganizations(),
    );
    if (!result) {
      return NextResponse.json({ success: true, skipped: true, reason: "sync already running" });
    }
    return NextResponse.json({ success: true, ...result });  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
