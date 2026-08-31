"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file, then restart the dev server.",
  invalid_state: "Sign-in session expired. Please click Connect Gmail again.",
  no_refresh_token: "Google did not return a refresh token. Disconnect the app in your Google Account and try again with consent prompt.",
  invalid_request:
    "Google blocked the OAuth request because a private LAN IP was used as the redirect URI. Use the localhost connect option below and add http://127.0.0.1:3000/api/gmail/callback to Google Cloud Console.",
};

export function GmailIntegrationPanel({
  redirectUri,
  googleConfigured,
  connectedEmail,
  lastSyncAt,
  errorCode,
  connected,
  lanMode = false,
  appBaseUrl,
  localhostConnectUrl,
}: {
  redirectUri: string;
  googleConfigured: boolean;
  connectedEmail?: string;
  lastSyncAt?: Date | null;
  errorCode?: string;
  connected?: boolean;
  lanMode?: boolean;
  appBaseUrl?: string;
  localhostConnectUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyRedirectUri() {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ??
      (errorCode.includes("device_id") || errorCode.includes("private IP")
        ? ERROR_MESSAGES.invalid_request
        : decodeURIComponent(errorCode))
    : null;

  return (
    <div className="space-y-4">
      {connected && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          Gmail connected successfully.
        </p>
      )}
      {errorMessage && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
          {errorMessage}
        </p>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Gmail — Resume Inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Gmail to pull resume attachments into Resume Inbox and send candidate emails from your own address.
          </p>

          {lanMode && !connectedEmail && googleConfigured && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-900">LAN mode — Gmail uses localhost for OAuth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-amber-950">
                <p>
                  App URL: <code className="text-xs">{appBaseUrl}</code> · OAuth redirect:{" "}
                  <code className="text-xs">{redirectUri}</code>
                </p>
                <p>
                  Google blocks private IPs like <code className="text-xs">192.168.x.x</code>. The redirect URI above
                  must be registered in Google Cloud Console — not the LAN address.
                </p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    In Google Cloud Console → Credentials → OAuth client, add this exact redirect URI:
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded bg-white border px-2 py-1.5 text-xs break-all">
                        {redirectUri}
                      </code>
                      <Button type="button" variant="outline" size="sm" onClick={copyRedirectUri}>
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </li>
                  <li>Restart the dev server after any <code className="text-xs">.env</code> change.</li>
                  <li>Click <strong>Connect Gmail via localhost</strong> below (log in on localhost if prompted).</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {!lanMode && googleConfigured && !connectedEmail && (
            <p className="text-xs text-muted-foreground">
              OAuth redirect URI: <code>{redirectUri}</code>
            </p>
          )}

          {connectedEmail ? (
            <div className="space-y-3">
              <p className="text-sm">
                Connected as <strong>{connectedEmail}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}
              </p>
              <p className="text-xs text-muted-foreground">
                If sync fails, try <strong>Disconnect Gmail</strong> above, then connect again.
              </p>
            </div>
          ) : !googleConfigured ? (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-900">One-time Google setup (~5 min)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-amber-950">
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Open{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 underline font-medium"
                    >
                      Google Cloud Console → Credentials
                    </a>
                  </li>
                  <li>Create an <strong>OAuth 2.0 Client ID</strong> (type: Web application)</li>
                  <li>
                    Enable the <strong>Gmail API</strong> for your project (
                    <a
                      href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 underline font-medium"
                    >
                      open Gmail API page
                    </a>
                    )
                  </li>
                  <li>
                    Add this <strong>Authorized redirect URI</strong>:
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded bg-white border px-2 py-1.5 text-xs break-all">
                        {redirectUri}
                      </code>
                      <Button type="button" variant="outline" size="sm" onClick={copyRedirectUri}>
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </li>
                  <li>
                    Copy the Client ID and Client Secret into your project <code className="text-xs">.env</code> file:
                    <pre className="mt-2 rounded bg-white border p-3 text-xs overflow-x-auto">{`GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"`}</pre>
                  </li>
                  <li>
                    <strong>Restart</strong> the dev server (<code className="text-xs">npm run dev</code>), then return here and click Connect Gmail
                  </li>
                </ol>
                <p className="text-xs text-amber-800 pt-1">
                  Your current <code>.env</code> has empty Google values — that is why Connect Gmail failed.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {googleConfigured && !connectedEmail && (
            lanMode && localhostConnectUrl ? (
              <Button asChild>
                <a href={localhostConnectUrl}>Connect Gmail via localhost</a>
              </Button>
            ) : (
              <Button asChild>
                <a href="/api/gmail/connect">Connect Gmail</a>
              </Button>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
