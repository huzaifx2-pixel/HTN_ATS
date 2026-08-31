import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildGmailAuthUrl, getGoogleOAuthConfig } from "@/lib/gmail/client";
import { createSignedGmailOAuthState } from "@/lib/gmail/oauth-state";
import { getAppBaseUrl, getRequestOrigin } from "@/lib/runtime/app-url";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const requestOrigin = getRequestOrigin(request);
  const appBaseUrl = getAppBaseUrl();

  if (!session?.user) {
    const loginUrl = new URL("/login", requestOrigin);
    loginUrl.searchParams.set("next", "/api/gmail/connect");
    return NextResponse.redirect(loginUrl);
  }

  if (!getGoogleOAuthConfig()) {
    return NextResponse.redirect(
      new URL("/admin/integrations?error=google_not_configured", appBaseUrl),
    );
  }

  const state = createSignedGmailOAuthState(session.user.id);
  return NextResponse.redirect(buildGmailAuthUrl(state));
}
