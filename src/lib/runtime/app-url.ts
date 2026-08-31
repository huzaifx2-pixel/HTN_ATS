/**
 * Central resolver for the application's public base URL.
 * Used for auth callbacks, apply links, email templates, and Gmail OAuth.
 */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.HEADSBASE_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

const PRIVATE_LAN_HOST =
  /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})$/;

export function isPrivateLanHost(hostname: string): boolean {
  return PRIVATE_LAN_HOST.test(hostname);
}

export function getLocalhostAppUrl(): string {
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

/** True when the app is served via a LAN IP (e.g. after npm run env:use-lan-url). */
export function appUsesPrivateLanUrl(): boolean {
  try {
    return isPrivateLanHost(new URL(getAppBaseUrl()).hostname);
  } catch {
    return false;
  }
}

/**
 * Google OAuth redirect URI. Google rejects private IPs (192.168.x.x) — only
 * localhost/127.0.0.1 are allowed for dev. Override with GOOGLE_OAUTH_REDIRECT_URI.
 */
export function getGoogleOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const port = process.env.PORT?.trim() || "3000";
  const baseUrl = getAppBaseUrl();

  try {
    if (isPrivateLanHost(new URL(baseUrl).hostname)) {
      return `${getLocalhostAppUrl()}/api/gmail/callback`;
    }
  } catch {
    /* use baseUrl below */
  }

  return `${baseUrl.replace(/\/+$/, "")}/api/gmail/callback`;
}

/** Resolve a browser-safe origin from an incoming request (avoids 0.0.0.0 bind address). */
export function getRequestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }

  const url = new URL(request.url);
  if (url.hostname === "0.0.0.0" || url.hostname === "[::]") {
    return getLocalhostAppUrl();
  }

  return url.origin;
}

export function getAppOrigin(): string {
  return new URL(getAppBaseUrl()).origin;
}

/** Origins allowed for Better Auth CSRF/origin checks (localhost + LAN). */
export function getTrustedOrigins(): string[] {
  const port = process.env.PORT?.trim() || "3000";
  const origins = new Set<string>([
    getAppOrigin(),
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]);

  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "HEADSBASE_APP_URL"] as const) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      /* ignore invalid URL */
    }
  }

  return [...origins];
}
