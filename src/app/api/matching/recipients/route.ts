import { NextRequest, NextResponse } from "next/server";
import { getActiveOrganization, requireSession } from "@/lib/auth/session";
import {
  getFollowUpRecipientsByJob,
  getPendingMatchRecipientsByJob,
  uniqueJobIds,
} from "@/lib/services/match-email-outreach-service";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const kind = request.nextUrl.searchParams.get("kind") === "followup" ? "followup" : "outreach";
    const jobIds = uniqueJobIds({
      jobId: request.nextUrl.searchParams.get("jobId") || undefined,
      jobIds: [
        ...request.nextUrl.searchParams.getAll("jobIds"),
        ...request.nextUrl.searchParams.getAll("jobId"),
      ].flatMap((value) => value.split(",")),
    });
    if (jobIds.length === 0) {
      return NextResponse.json({ error: "Select at least one job" }, { status: 400 });
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 2000) : 40;
    const groups =
      kind === "followup"
        ? await getFollowUpRecipientsByJob(member.organizationId, { jobIds, limit })
        : await getPendingMatchRecipientsByJob(member.organizationId, { jobIds, limit });

    const recipients = groups.flatMap((group) =>
      group.recipients.map((recipient) => ({
        ...recipient,
        jobId: group.jobId,
        jobTitle: group.jobTitle,
      })),
    );

    return NextResponse.json({ groups, recipients });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
