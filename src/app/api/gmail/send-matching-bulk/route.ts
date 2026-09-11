import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { sendMatchingHubEmails } from "@/lib/services/email-service";
import { uniqueJobIds } from "@/lib/services/match-email-outreach-service";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission("send_email");
    const body = await request.json();
    const kind = body.kind === "followup" ? "followup" : "outreach";
    const jobId = typeof body.jobId === "string" && body.jobId ? body.jobId : undefined;
    const jobIds = uniqueJobIds({
      jobId,
      jobIds: Array.isArray(body.jobIds)
        ? body.jobIds.filter((id: unknown): id is string => typeof id === "string")
        : typeof body.jobIds === "string"
          ? body.jobIds.split(",")
          : [],
    });
    if (jobIds.length === 0) {
      return NextResponse.json({ error: "Select at least one job" }, { status: 400 });
    }

    const result = await sendMatchingHubEmails({
      kind,
      jobIds,
      templateId: body.templateId,
      customLink: body.customLink,
      subject: body.subject,
      body: body.body,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    });

    return NextResponse.json({
      type: "done",
      ...result,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
