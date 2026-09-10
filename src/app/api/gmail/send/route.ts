import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { sendEmailAsOrg } from "@/lib/services/gmail-service";
import { markCandidateEngaged } from "@/lib/services/candidate-service";
import { assertEmailCanBeContacted } from "@/lib/services/contact-compliance-service";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-error";
import { formatEmailBodyHtml } from "@/lib/email-body-html";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission("send_email");
    const { to, subject, body, candidateId } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
    }

    await assertEmailCanBeContacted(to, ctx.organizationId);

    const result = await sendEmailAsOrg(ctx.organizationId, ctx.userId, to, subject, formatEmailBodyHtml(body));

    if (candidateId) {
      const candidate = await prisma.candidate.findFirst({
        where: { id: candidateId, organizationId: ctx.organizationId, deletedAt: null },
      });
      if (candidate) {
        await markCandidateEngaged(candidate.id, ctx.organizationId);
        await prisma.candidateActivity.create({
          data: {
            candidateId: candidate.id,
            action: "email.sent",
            metadata: { subject, to },
          },
        });
      }
    }

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
