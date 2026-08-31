import { NextResponse } from "next/server";
import { getActiveOrganization, requireSession } from "@/lib/auth/session";
import { getOpenMatchEmailRecipients } from "@/lib/services/pipeline-service";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const recipients = await getOpenMatchEmailRecipients(jobId, member.organizationId);
    return NextResponse.json({ recipients });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
