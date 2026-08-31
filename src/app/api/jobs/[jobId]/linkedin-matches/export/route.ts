import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";
import { exportLinkedInMatchesCsv } from "@/lib/services/linkedin-match-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const ctx = await requirePermission("create_job");
    const { jobId } = await params;
    const csv = await exportLinkedInMatchesCsv(jobId, ctx.organizationId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="linkedin-matches-${jobId}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
