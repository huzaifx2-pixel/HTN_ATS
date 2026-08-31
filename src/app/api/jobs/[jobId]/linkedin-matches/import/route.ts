import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { importLinkedInMatches } from "@/lib/services/linkedin-match-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await importLinkedInMatches(jobId, {
      ids: Array.isArray(body.ids) ? body.ids : undefined,
      all: Boolean(body.all),
      search: typeof body.search === "string" ? body.search : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      company: typeof body.company === "string" ? body.company : undefined,
      education: typeof body.education === "string" ? body.education : undefined,
      experience: typeof body.experience === "string" ? body.experience : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
