import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { refreshLinkedInMatches } from "@/lib/services/linkedin-match-service";

export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const result = await refreshLinkedInMatches(jobId);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
