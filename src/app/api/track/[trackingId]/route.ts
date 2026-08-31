import { NextRequest, NextResponse } from "next/server";
import { trackEmailOpen, trackEmailClick } from "@/lib/services/email-service";
import { trackMarketingOpen, trackMarketingClick } from "@/lib/services/marketing-track-service";

function safeRedirectUrl(request: NextRequest, rawUrl: string | null): string {
  const fallback = new URL("/", request.url).toString();
  if (!rawUrl) return fallback;
  try {
    const target = new URL(rawUrl, request.url);
    const origin = new URL(request.url);
    if (target.origin !== origin.origin) return fallback;
    return target.toString();
  } catch {
    return fallback;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const action = request.nextUrl.searchParams.get("action");

  const channel = request.nextUrl.searchParams.get("channel");

  if (action === "click") {
    if (channel === "marketing") {
      await trackMarketingClick(trackingId);
    } else {
      await trackEmailClick(trackingId);
    }
    return NextResponse.redirect(safeRedirectUrl(request, request.nextUrl.searchParams.get("url")));
  }

  if (channel === "marketing") {
    await trackMarketingOpen(trackingId);
  } else {
    await trackEmailOpen(trackingId);
  }
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  return new NextResponse(pixel, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache" },
  });
}
