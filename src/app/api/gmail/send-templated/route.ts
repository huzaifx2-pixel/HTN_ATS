import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { sendTemplatedEmailToCandidate } from "@/lib/services/email-service";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    const { jobId, candidateId, templateId, customLink, subject, body: emailBody, skipDuplicateCheck } = body;
    if (!jobId || !candidateId) {
      return NextResponse.json({ error: "jobId and candidateId are required" }, { status: 400 });
    }

    const result = await sendTemplatedEmailToCandidate({
      jobId,
      candidateId,
      templateId,
      customLink,
      subject,
      body: emailBody,
      userId: session.user.id,
      skipDuplicateCheck: Boolean(skipDuplicateCheck),
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
