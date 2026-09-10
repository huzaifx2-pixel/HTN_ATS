import { NextRequest, NextResponse } from "next/server";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { buildGmailAuthUrl, getGoogleOAuthConfig } from "@/lib/gmail/client";
import { createSignedGmailOAuthState } from "@/lib/gmail/oauth-state";
import { getAppBaseUrl, getRequestOrigin } from "@/lib/runtime/app-url";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const requestOrigin = getRequestOrigin(request);
  const appBaseUrl = getAppBaseUrl();
  const nextPath = "/api/gmail/connect-outreach";

  if (!session?.user) {
    const loginUrl = new URL("/login", requestOrigin);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  const member = await getActiveOrganization(session.user.id);
  if (!member) {
    return NextResponse.redirect(new URL("/signup", appBaseUrl));
  }

  if (!getGoogleOAuthConfig()) {
    return NextResponse.redirect(
      new URL("/admin/integrations?error=google_not_configured", appBaseUrl),
    );
  }

  const state = createSignedGmailOAuthState(session.user.id, {
    purpose: "outreach",
    organizationId: member.organizationId,
  });
  return NextResponse.redirect(buildGmailAuthUrl(state));
}
