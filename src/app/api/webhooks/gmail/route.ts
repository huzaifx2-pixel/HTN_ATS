import { NextResponse } from "next/server";
import { syncGmailForUser } from "@/lib/services/gmail-service";
import { requireSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST() {
  try {
    const session = await requireSession();
    const result = await syncGmailForUser(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
