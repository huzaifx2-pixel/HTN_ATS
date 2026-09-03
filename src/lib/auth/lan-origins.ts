const port = process.env.PORT?.trim() || "3000";

/** Private LAN origins allowed for Better Auth (any device on local network). */
export function isAllowedLanOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.port && url.port !== port) return false;

    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function originFromHeaderValue(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).origin;
    }
    return new URL(`http://${value}`).origin;
  } catch {
    return null;
  }
}

export function resolveTrustedOrigins(request?: Request): string[] {
  const origins = new Set<string>([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]);

  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "HEADSBASE_APP_URL"] as const) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      /* ignore */
    }
  }

  const candidates = [
    request?.headers.get("origin"),
    originFromHeaderValue(request?.headers.get("referer")),
    originFromHeaderValue(request?.headers.get("x-forwarded-host")),
    originFromHeaderValue(request?.headers.get("host")),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isAllowedLanOrigin(candidate)) {
      origins.add(candidate);
      continue;
    }
    // Allow the configured public app origin (Netlify / Railway) even when
    // the proxied Host header differs from BETTER_AUTH_URL.
    try {
      const host = new URL(candidate).hostname;
      for (const known of origins) {
        if (new URL(known).hostname === host) {
          origins.add(candidate);
          break;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return [...origins];
}
