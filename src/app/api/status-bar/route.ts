import { NextResponse } from "next/server";
import { getActiveOrganization, requireSession } from "@/lib/auth/session";
import { getStatusBarSnapshot } from "@/lib/services/status-bar-service";
import { apiErrorResponse } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await getStatusBarSnapshot(member.organizationId);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
