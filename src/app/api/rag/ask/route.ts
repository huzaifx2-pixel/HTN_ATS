import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/session";
import { askAts } from "@/lib/rag/ask";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const ctx = await requireOrgContext();
    const body = (await request.json().catch(() => ({}))) as { query?: string };
    const query = body.query?.trim() ?? "";
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    const result = await askAts(ctx.organizationId, query);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
