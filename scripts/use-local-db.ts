/**
 * Point .env at local PostgreSQL (Docker or native install).
 * Usage:
 *   npm run env:use-local-db
 *   npm run env:use-local-db -- 5433
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLocalDatabaseUrl, detectPostgresPort } from "./lib/postgres-detect";

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example to .env first.");
  process.exit(1);
}

const portArg = Number(process.argv[2]);

async function main() {
  const detected =
    Number.isFinite(portArg) && portArg > 0 ? portArg : await detectPostgresPort();
  if (!detected) {
    console.error(`
No PostgreSQL detected on ports 5433, 5432, or 5434.

Install one of:
  A) PostgreSQL 17:  winget install PostgreSQL.PostgreSQL.17
     Then create database "headsbase_ats" and re-run this command.

  B) Docker Desktop: https://www.docker.com/products/docker-desktop/
     Then: npm run setup:lan
`);
    process.exit(1);
  }

  const LOCAL_URL = buildLocalDatabaseUrl(detected);

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

  setOrReplace("DATABASE_URL", LOCAL_URL);
  setOrReplace("DIRECT_URL", LOCAL_URL);
  setOrReplace("STORAGE_PROVIDER", "local");

  writeFileSync(envPath, env, "utf8");

  console.log("Updated .env for local PostgreSQL:");
  console.log(`  DATABASE_URL=${LOCAL_URL}`);
  console.log(`  DIRECT_URL=${LOCAL_URL}`);
  console.log(`  Detected Postgres on port ${detected}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
