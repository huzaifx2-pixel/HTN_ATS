import { NextResponse } from "next/server";
import { getActiveOrganization, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { RecruiterMatchAnalysis } from "@/lib/matching/recruiter-engine/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; candidateId: string }> }
) {
  try {
    const { jobId, candidateId } = await params;
    const session = await requireSession();
    const member = await getActiveOrganization(session.user.id);
    if (!member) {
      return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const match = await prisma.jobMatch.findFirst({
      where: {
        jobId,
        candidateId,
        job: { organizationId: member.organizationId },
      },
      select: {
        score: true,
        analysis: true,
        reason: true,
        computedAt: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({
      score: match.score,
      reason: match.reason,
      computedAt: match.computedAt,
      analysis: match.analysis as RecruiterMatchAnalysis | null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load match analysis" },
      { status: 500 }
    );
  }
}
