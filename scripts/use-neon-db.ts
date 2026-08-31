/**
 * Configure .env for Neon PostgreSQL (free Supabase alternative).
 * Paste pooled + direct URLs from https://console.neon.tech → Connect
 *
 * Usage:
 *   npx tsx scripts/use-neon-db.ts "postgresql://...-pooler.../neondb?sslmode=require" "postgresql://.../neondb?sslmode=require"
 * Or set NEON_DATABASE_URL and NEON_DIRECT_URL in .env.neon then: npm run env:use-neon-db
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.neon") });

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example to .env first.");
  process.exit(1);
}

const pooled = process.argv[2] || process.env.NEON_DATABASE_URL?.trim();
const direct = process.argv[3] || process.env.NEON_DIRECT_URL?.trim() || pooled?.replace("-pooler.", ".");

if (!pooled) {
  console.error(`
Neon database URLs required.

1. Create free project at https://console.neon.tech
2. Copy connection strings from Connect button:
   - Pooled (for DATABASE_URL)
   - Direct / unpooled (for DIRECT_URL)
3. Run:
   npm run env:use-neon-db -- "POOLED_URL" "DIRECT_URL"

Or create .env.neon:
  NEON_DATABASE_URL="postgresql://...@ep-xxx-pooler.../neondb?sslmode=require"
  NEON_DIRECT_URL="postgresql://...@ep-xxx.../neondb?sslmode=require"
`);
  process.exit(1);
}

const original = readFileSync(envPath, "utf8");
const backupPath = resolve(process.cwd(), ".env.supabase.bak");
if (!existsSync(backupPath)) {
  writeFileSync(backupPath, original, "utf8");
  console.log("Backed up current .env to .env.supabase.bak");
}

let env = original;

function setOrReplace(key: string, value: string) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, `${key}="${value}"`);
  } else {
    env = `${key}="${value}"\n${env}`;
  }
}

setOrReplace("DATABASE_URL", pooled);
setOrReplace("DIRECT_URL", direct ?? pooled);
setOrReplace("STORAGE_PROVIDER", "local");

writeFileSync(envPath, env, "utf8");

console.log("Updated .env for Neon PostgreSQL.");
console.log("Next: npm run db:push && npm run db:seed && npm run dev");
