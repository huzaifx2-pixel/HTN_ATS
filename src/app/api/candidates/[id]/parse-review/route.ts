import { NextRequest, NextResponse } from "next/server";
import { getActiveOrganization, requirePermission, requireSession } from "@/lib/auth/session";
import { applyParseReview, listParseReviewFields } from "@/lib/services/parse-review-service";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("edit_job");
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) return NextResponse.json({ error: "No organization" }, { status: 403 });
    const { id } = await context.params;
    const fields = await listParseReviewFields(id, member.organizationId);
    return NextResponse.json({ fields });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("edit_job");
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) return NextResponse.json({ error: "No organization" }, { status: 403 });
    const { id } = await context.params;
    const body = (await request.json()) as {
      entity: "candidate" | "experience" | "education" | "certification" | "skill";
      id: string;
      reviewStatus: "approved" | "corrected";
      value?: string;
    };
    await applyParseReview({
      candidateId: id,
      organizationId: member.organizationId,
      entity: body.entity,
      id: body.id,
      reviewStatus: body.reviewStatus,
      value: body.value,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
