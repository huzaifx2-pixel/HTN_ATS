import { NextRequest, NextResponse } from "next/server";
import { getChannelMessages } from "@/lib/services/messaging-service";
import { requireOrgContext } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const ctx = await requireOrgContext();
    const { channelId } = await params;
    const messages = await getChannelMessages(channelId, ctx.organizationId);
    return NextResponse.json(messages);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
