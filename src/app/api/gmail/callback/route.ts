import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getGoogleUserEmail } from "@/lib/gmail/client";
import { verifySignedGmailOAuthState } from "@/lib/gmail/oauth-state";
import { saveGmailConnection } from "@/lib/services/gmail-service";
import { getAppBaseUrl, getRequestOrigin } from "@/lib/runtime/app-url";

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl();
  const requestOrigin = getRequestOrigin(request);
  const callbackOrigin =
    requestOrigin.includes("127.0.0.1") || requestOrigin.includes("localhost")
      ? requestOrigin
      : baseUrl;
  const integrationsUrl = new URL("/admin/integrations", callbackOrigin);

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    integrationsUrl.searchParams.set("error", error);
    return NextResponse.redirect(integrationsUrl);
  }

  const userId = state ? verifySignedGmailOAuthState(state) : null;
  if (!code || !userId) {
    integrationsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(integrationsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      integrationsUrl.searchParams.set("error", "no_refresh_token");
      return NextResponse.redirect(integrationsUrl);
    }

    const email = await getGoogleUserEmail(tokens.access_token);
    await saveGmailConnection(userId, email, tokens.access_token, tokens.refresh_token);

    integrationsUrl.searchParams.set("connected", "1");
    return NextResponse.redirect(integrationsUrl);
  } catch (e) {
    integrationsUrl.searchParams.set("error", (e as Error).message);
    return NextResponse.redirect(integrationsUrl);
  }
}
