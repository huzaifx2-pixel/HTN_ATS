import { NextResponse } from "next/server";
import { getActiveOrganization, requirePermission, requireSession } from "@/lib/auth/session";
import {
  getWebsiteJobSyncStatus,
  setWebsiteJobAutoSyncEnabled,
  syncWebsiteJobsForOrganization,
} from "@/lib/services/website-job-sync-service";
import { runWorker } from "@/lib/jobs/scheduler-status";
import { apiErrorResponse } from "@/lib/api-error";

export const maxDuration = 300;

export async function GET() {
  try {
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const status = await getWebsiteJobSyncStatus(member.organizationId);
    return NextResponse.json(status);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST() {
  try {
    const ctx = await requirePermission("admin");
    const stats = await runWorker("website-job-sync", () =>
      syncWebsiteJobsForOrganization(ctx.organizationId),
    );
    if (!stats) {
      return NextResponse.json({ error: "Website sync already in progress" }, { status: 409 });
    }
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requirePermission("admin");
    const body = (await request.json().catch(() => null)) as { autoSyncEnabled?: unknown } | null;
    if (typeof body?.autoSyncEnabled !== "boolean") {
      return NextResponse.json({ error: "autoSyncEnabled must be a boolean" }, { status: 400 });
    }

    await setWebsiteJobAutoSyncEnabled(ctx.organizationId, body.autoSyncEnabled);
    const status = await getWebsiteJobSyncStatus(ctx.organizationId);
    return NextResponse.json(status);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
