import { NextRequest, NextResponse } from "next/server";
import { runGmailSyncForAllConnections } from "@/lib/services/gmail-sync-runner";
import { apiErrorResponse } from "@/lib/api-error";
import { runWorker, registerWorker } from "@/lib/jobs/scheduler-status";

registerWorker("gmail-sync", true);

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export const maxDuration = 300;

async function handleCron() {
  const result = await runWorker("gmail-sync", runGmailSyncForAllConnections);
  return NextResponse.json({ success: true, result });
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleCron();
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
