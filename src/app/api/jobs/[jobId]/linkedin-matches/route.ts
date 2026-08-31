import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";
import {
  getLinkedInMatchStats,
  listLinkedInMatches,
  linkedInSearchConfigured,
} from "@/lib/services/linkedin-match-service";
import { getGoogleCseStatus } from "@/lib/sourcing/google-cse";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const ctx = await requirePermission("create_job");
    const { jobId } = await params;
    const search = request.nextUrl.searchParams;

    const [list, stats] = await Promise.all([
      listLinkedInMatches(jobId, ctx.organizationId, {
        search: search.get("search") ?? undefined,
        location: search.get("location") ?? undefined,
        company: search.get("company") ?? undefined,
        education: search.get("education") ?? undefined,
        experience: search.get("experience") ?? undefined,
        page: Number(search.get("page") ?? 1) || 1,
      }),
      getLinkedInMatchStats(jobId, ctx.organizationId),
    ]);

    return NextResponse.json({
      ...list,
      stats,
      configured: linkedInSearchConfigured(),
      cse: getGoogleCseStatus(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
