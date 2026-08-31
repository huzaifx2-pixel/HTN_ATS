/**
 * Runtime Prisma should use DATABASE_URL (pooled).
 * DIRECT_URL is only for migrations / schema push (prisma schema `directUrl`).
 *
 * Previously the client preferred DIRECT_URL, which bypasses PgBouncer/Neon pooler
 * and opens a new session per Prisma connection.
 */

export function resolveDatabaseUrl(): string {
  return resolveRuntimeDatabaseUrl();
}

export function resolveRuntimeDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
  if (!configured) return "";

  try {
    const parsed = new URL(configured);
    const pooled = isPooledUrl(parsed);

    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", pooled ? "5" : "10");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", pooled ? "15" : "30");
    }
    if (pooled && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    return parsed.toString();
  } catch {
    return configured;
  }
}

export function isPooledUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const port = url.port;
  return (
    url.searchParams.get("pgbouncer") === "true" ||
    port === "6543" ||
    host.includes("pooler.supabase.com") ||
    host.includes("-pooler.") ||
    host.includes("pgbouncer")
  );
}
