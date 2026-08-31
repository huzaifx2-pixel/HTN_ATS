import { NextResponse } from "next/server";
import { getActiveOrganization, requireSession } from "@/lib/auth/session";
import { syncGmailForUser } from "@/lib/services/gmail-service";
import { broadcastOrgSync } from "@/lib/realtime/sync";
import { apiErrorResponse } from "@/lib/api-error";

export const maxDuration = 300;

export async function POST() {
  try {
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    const result = await syncGmailForUser(session.user.id);

    if (member && (result.imported ?? 0) > 0) {
      broadcastOrgSync(member.organizationId, {
        type: "inbox",
        paths: ["/candidates/inbox", "/candidates", "/dashboard"],
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[gmail/sync]", error);
    return apiErrorResponse(error);
  }
}
