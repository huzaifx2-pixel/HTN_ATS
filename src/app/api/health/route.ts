import { NextResponse } from "next/server";

/** Lightweight readiness probe for desktop shell startup synchronization. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "headsbase-ats",
    timestamp: new Date().toISOString(),
  });
}
