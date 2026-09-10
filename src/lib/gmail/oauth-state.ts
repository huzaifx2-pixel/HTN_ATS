import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

export type GmailOAuthPurpose = "inbox" | "outreach";

export type GmailOAuthState = {
  userId: string;
  purpose: GmailOAuthPurpose;
  organizationId?: string;
};

function getSigningSecret(): string {
  const secret =
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for Gmail OAuth state signing.");
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const sigBuf = Buffer.from(a);
  const expBuf = Buffer.from(b);
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

/** Signed OAuth state embeds userId so localhost callback works without LAN cookies. */
export function createSignedGmailOAuthState(
  userId: string,
  options?: { purpose?: GmailOAuthPurpose; organizationId?: string },
): string {
  const nonce = randomBytes(16).toString("hex");
  const exp = String(Date.now() + STATE_TTL_MS);
  const purpose = options?.purpose ?? "inbox";
  const organizationId = options?.organizationId || "_";
  const payload = `${userId}.${nonce}.${exp}.${purpose}.${organizationId}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`, "utf8").toString("base64url");
}

export function verifySignedGmailOAuthState(state: string): GmailOAuthState | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");

    if (parts.length === 4) {
      const [userId, nonce, exp, signature] = parts;
      if (!userId || !nonce || !exp || !signature) return null;
      if (Date.now() > Number(exp)) return null;
      const payload = `${userId}.${nonce}.${exp}`;
      if (!safeEqual(signature, signPayload(payload))) return null;
      return { userId, purpose: "inbox" };
    }

    if (parts.length !== 6) return null;
    const [userId, nonce, exp, purpose, organizationId, signature] = parts;
    if (!userId || !nonce || !exp || !purpose || !organizationId || !signature) return null;
    if (Date.now() > Number(exp)) return null;
    const payload = `${userId}.${nonce}.${exp}.${purpose}.${organizationId}`;
    if (!safeEqual(signature, signPayload(payload))) return null;
    if (purpose !== "inbox" && purpose !== "outreach") return null;
    return {
      userId,
      purpose,
      organizationId: organizationId === "_" ? undefined : organizationId,
    };
  } catch {
    return null;
  }
}
