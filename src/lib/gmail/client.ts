const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

import { getGoogleOAuthRedirectUri } from "@/lib/runtime/app-url";
import { isHtmlEmailBody, linkifyUrlsInHtml } from "@/lib/email-body-html";

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = getGoogleOAuthRedirectUri();

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildGmailAuthUrl(state: string) {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("Google OAuth is not configured");

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("Google OAuth is not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("Google OAuth is not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh Gmail token: ${err}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getGoogleUserEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  const data = await res.json();
  return data.email as string;
}

function encodeMimeHeader(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

function buildRawEmail(from: string, to: string, subject: string, body: string) {
  const html = isHtmlEmailBody(body)
    ? linkifyUrlsInHtml(body)
    : linkifyUrlsInHtml(body.replace(/\n/g, "<br>"));
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

export async function sendGmailMessage(
  accessToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  body: string
) {
  const raw = buildRawEmail(fromEmail, to, subject, body);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    await parseGmailApiError(res, "Failed to send Gmail message");
  }

  return res.json();
}

async function parseGmailApiError(res: Response, fallback: string): Promise<never> {
  const text = await res.text();
  let detail = fallback;

  try {
    const body = JSON.parse(text) as { error?: { message?: string } };
    const msg = body.error?.message;
    if (msg) {
      if (msg.includes("Gmail API has not been used") || msg.includes("has not been enabled")) {
        detail =
          "Gmail API is not enabled in this Google Cloud project. Open APIs & Services → Gmail API and click Enable.";
      } else if (msg.includes("insufficient authentication scopes")) {
        detail = "Gmail permissions are missing. Disconnect and reconnect Gmail in Integrations.";
      } else if (res.status === 403 && msg.includes("Access Not Configured")) {
        detail =
          "Gmail API is not enabled in this Google Cloud project. Open APIs & Services → Gmail API and click Enable.";
      } else if (res.status === 403) {
        detail = `${msg} If you use Google Workspace, your admin may need to allow third-party Gmail access.`;
      } else if (res.status === 401 || msg.includes("invalid_grant")) {
        detail = "Gmail session expired. Disconnect and reconnect Gmail in Integrations.";
      } else {
        detail = msg;
      }
    } else if (text) {
      detail = text.slice(0, 300);
    }
  } catch {
    if (text) detail = text.slice(0, 300);
  }

  console.error("[gmail]", res.status, detail);
  throw new Error(detail);
}

const RESUME_QUERY =
  "has:attachment (filename:pdf OR filename:doc OR filename:docx OR filename:rtf) -filename:invoice -filename:receipt -filename:contract -filename:statement";

async function fetchGmailMessagePage(
  accessToken: string,
  maxResults: number,
  q?: string,
  pageToken?: string
) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (q) params.set("q", q);
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) await parseGmailApiError(res, "Failed to list Gmail messages");
  const data = await res.json();
  return {
    messages: (data.messages ?? []) as Array<{ id: string; threadId: string }>,
    nextPageToken: data.nextPageToken as string | undefined,
  };
}

export async function listAllResumeMessages(
  accessToken: string,
  options?: { after?: Date | null },
) {
  const afterUnix = options?.after ? Math.floor(options.after.getTime() / 1000) : undefined;
  const afterClause = afterUnix ? ` after:${afterUnix}` : "";
  const resumeQuery = `${RESUME_QUERY}${afterClause}`.trim();
  const fallbackQuery = afterClause.trim();
  const all: Array<{ id: string; threadId: string }> = [];
  let pageToken: string | undefined;

  do {
    try {
      const page = await fetchGmailMessagePage(accessToken, 500, resumeQuery, pageToken);
      all.push(...page.messages);
      pageToken = page.nextPageToken;
    } catch (error) {
      const message = (error as Error).message;
      if (all.length === 0 && (message.includes("400") || message.toLowerCase().includes("invalid"))) {
        const page = await fetchGmailMessagePage(
          accessToken,
          500,
          fallbackQuery || undefined,
          pageToken,
        );
        all.push(...page.messages);
        pageToken = page.nextPageToken;
      } else {
        throw error;
      }
    }
  } while (pageToken);

  return all;
}

export async function listResumeMessages(accessToken: string, maxResults = 20) {
  try {
    const page = await fetchGmailMessagePage(accessToken, maxResults, RESUME_QUERY);
    return page.messages;
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("400") || message.toLowerCase().includes("invalid")) {
      const page = await fetchGmailMessagePage(accessToken, maxResults);
      return page.messages;
    }
    throw error;
  }
}

export async function getMessageWithAttachments(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch message");

  const message = await res.json();
  const attachments: Array<{ attachmentId: string; fileName: string; mimeType: string; size: number }> = [];

  function addPart(part: Record<string, unknown>) {
    const filename = part.filename as string | undefined;
    const body = part.body as { attachmentId?: string; size?: number } | undefined;
    const mimeType = part.mimeType as string | undefined;
    if (filename && body?.attachmentId) {
      attachments.push({
        attachmentId: body.attachmentId,
        fileName: filename,
        mimeType: mimeType ?? "application/octet-stream",
        size: body.size ?? 0,
      });
    }
  }

  function walkParts(parts: Array<Record<string, unknown>> | undefined) {
    if (!parts) return;
    for (const part of parts) {
      addPart(part);
      walkParts(part.parts as Array<Record<string, unknown>> | undefined);
    }
  }

  const payload = message.payload as Record<string, unknown> | undefined;
  if (payload) {
    addPart(payload);
    walkParts(payload.parts as Array<Record<string, unknown>> | undefined);
  }

  return { messageId, attachments };
}

export async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to download attachment");

  const data = await res.json();
  return Buffer.from(data.data, "base64url");
}

const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx", ".rtf", ".txt", ".png", ".jpg", ".jpeg"];

const NON_RESUME_FILENAME = [
  /invoice/i,
  /receipt/i,
  /contract/i,
  /agreement/i,
  /statement/i,
  /brochure/i,
  /proposal/i,
  /report/i,
  /timesheet/i,
  /payslip/i,
  /paystub/i,
  /offer\s*letter/i,
  /cover\s*letter/i,
  /w-?2/i,
  /1099/i,
  /tax/i,
  /bank/i,
  /insurance/i,
  /policy/i,
  /manual/i,
  /guide/i,
  /catalog/i,
];

export function isResumeAttachment(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase();
  if (NON_RESUME_FILENAME.some((pattern) => pattern.test(lower))) return false;
  if (RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/rtf",
    "text/rtf",
  ].includes(mimeType);
}
