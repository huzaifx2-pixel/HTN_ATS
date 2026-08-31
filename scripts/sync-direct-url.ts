/**
 * Ensures DIRECT_URL exists in .env (derived from DATABASE_URL for Supabase pooler).
 * Run: npm run env:sync-direct-url
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

function deriveDirectUrl(poolerUrl: string): string {
  if (!poolerUrl.includes("pooler.supabase.com")) {
    return poolerUrl.replace(":6543/", ":5432/").replace(/([?&])pgbouncer=true&?/g, "$1");
  }
  const refMatch = poolerUrl.match(/postgres(?:ql)?:\/\/postgres\.([^:@/]+)/i);
  if (!refMatch) return poolerUrl;
  const direct = new URL(poolerUrl);
  direct.username = "postgres";
  direct.password = decodeURIComponent(direct.password);
  direct.hostname = `db.${refMatch[1]}.supabase.co`;
  direct.port = "5432";
  direct.searchParams.delete("pgbouncer");
  direct.searchParams.delete("connection_limit");
  direct.searchParams.delete("pool_timeout");
  if (!direct.searchParams.has("sslmode")) direct.searchParams.set("sslmode", "require");
  return direct.toString();
}

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(".env not found");
  process.exit(1);
}

const content = readFileSync(envPath, "utf8");
if (/^DIRECT_URL=/m.test(content)) {
  console.log("DIRECT_URL already set in .env");
  process.exit(0);
}

const dbMatch = content.match(/^DATABASE_URL="([^"]+)"/m) ?? content.match(/^DATABASE_URL=(.+)$/m);
if (!dbMatch) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const directUrl = deriveDirectUrl(dbMatch[1].trim());
const line = `\n# Auto-derived for Prisma writes/migrations (P0 stability)\nDIRECT_URL="${directUrl}"\n`;
writeFileSync(envPath, content.trimEnd() + line, "utf8");
console.log("Added DIRECT_URL to .env");
