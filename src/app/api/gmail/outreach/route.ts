import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";
import {
  getOutreachPoolSummary,
  listOutreachMailboxes,
  upsertMatchOutreachDelayMs,
} from "@/lib/services/outreach-mailbox-service";

export async function GET() {
  try {
    const ctx = await requireOrgContext();
    const [mailboxes, summary] = await Promise.all([
      listOutreachMailboxes(ctx.organizationId),
      getOutreachPoolSummary(ctx.organizationId),
    ]);
    return NextResponse.json({ mailboxes, summary });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireOrgContext();
    const body = await request.json();
    if (typeof body.delayMs === "number") {
      await upsertMatchOutreachDelayMs(ctx.organizationId, body.delayMs);
    } else if (typeof body.delaySeconds === "number") {
      await upsertMatchOutreachDelayMs(ctx.organizationId, body.delaySeconds * 1000);
    } else {
      return NextResponse.json({ error: "delaySeconds is required" }, { status: 400 });
    }
    const summary = await getOutreachPoolSummary(ctx.organizationId);
    return NextResponse.json({ summary });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
