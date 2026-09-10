import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";
import {
  disconnectOutreachMailbox,
  setOutreachMailboxActive,
  updateOutreachMailboxLimit,
} from "@/lib/services/outreach-mailbox-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgContext();
    const { id } = await context.params;
    const body = await request.json();

    if (typeof body.dailySendLimit === "number") {
      await updateOutreachMailboxLimit(ctx.organizationId, id, body.dailySendLimit);
    }
    if (typeof body.isActive === "boolean") {
      await setOutreachMailboxActive(ctx.organizationId, id, body.isActive);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrgContext();
    const { id } = await context.params;
    await disconnectOutreachMailbox(ctx.organizationId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
