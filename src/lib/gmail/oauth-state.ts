import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

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

/** Signed OAuth state embeds userId so localhost callback works without LAN cookies. */
export function createSignedGmailOAuthState(userId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const exp = String(Date.now() + STATE_TTL_MS);
  const payload = `${userId}.${nonce}.${exp}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`, "utf8").toString("base64url");
}

export function verifySignedGmailOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;

    const [userId, nonce, exp, signature] = parts;
    if (!userId || !nonce || !exp || !signature) return null;
    if (Date.now() > Number(exp)) return null;

    const payload = `${userId}.${nonce}.${exp}`;
    const expected = signPayload(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}
