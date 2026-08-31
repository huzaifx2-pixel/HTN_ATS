import { NextResponse } from "next/server";
import { getGoogleOAuthConfig } from "@/lib/gmail/client";
import {
  appUsesPrivateLanUrl,
  getAppBaseUrl,
  getGoogleOAuthRedirectUri,
  getLocalhostAppUrl,
} from "@/lib/runtime/app-url";

/** Read-only diagnostic: confirms which OAuth redirect URI the running server uses. */
export async function GET() {
  const oauthRedirectUri = getGoogleOAuthRedirectUri();
  return NextResponse.json({
    configured: Boolean(getGoogleOAuthConfig()),
    appBaseUrl: getAppBaseUrl(),
    oauthRedirectUri,
    lanMode: appUsesPrivateLanUrl(),
    localhostConnectUrl: `${getLocalhostAppUrl()}/api/gmail/connect`,
    googleConsoleHint:
      "Register oauthRedirectUri in Google Cloud Console → Credentials → OAuth client. LAN IPs (192.168.x.x) are rejected by Google.",
  });
}
