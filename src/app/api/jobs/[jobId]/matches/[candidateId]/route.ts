import { NextResponse } from "next/server";
import { getActiveOrganization, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { computeMatch } from "@/lib/matching/engine";

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
      include: {
        job: true,
        candidate: {
          include: {
            parsedResume: {
              select: {
                rawText: true,
                skills: true,
                experience: true,
                education: true,
                certifications: true,
                structured: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const result = computeMatch(match.job, match.candidate, undefined, {
      resumeText: match.candidate.parsedResume?.rawText ?? undefined,
      parsedResume: match.candidate.parsedResume ?? undefined,
    });

    return NextResponse.json({
      score: result.score,
      storedScore: match.score,
      reason: result.reason,
      computedAt: match.computedAt,
      analysis: result.analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load match analysis" },
      { status: 500 }
    );
  }
}
