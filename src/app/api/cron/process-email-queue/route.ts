import { NextRequest, NextResponse } from "next/server";
import { processEmailRetryQueue } from "@/lib/services/email-retry-service";
import { processMatchOutreachQueue } from "@/lib/services/match-outreach-queue-service";
import { apiErrorResponse } from "@/lib/api-error";
import { runWorker } from "@/lib/jobs/scheduler-status";

export const maxDuration = 60;

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
    const result = await runWorker("email-retry-cron", async () => {
      const outreach = await processMatchOutreachQueue({ timeBudgetMs: 50_000, maxSends: 80 });
      const retry = await processEmailRetryQueue();
      return { outreach, retry };
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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
    const result = await runWorker("email-retry-cron", () => processEmailRetryQueue());
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
