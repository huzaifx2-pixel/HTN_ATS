/**
 * Bootstrap database schema after URLs are configured.
 * Does NOT load demo data — production-safe by default.
 *
 * Usage:
 *   npm run setup:db          # schema only
 *   npm run setup:db:demo     # schema + demo users/jobs (dev only)
 */
import { spawnSync } from "child_process";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

const includeDemo = process.argv.includes("--demo");

function run(cmd: string, optional = false): boolean {
  console.log(`\n> ${cmd}\n`);
  const result = spawnSync(cmd, {
    shell: true,
    cwd: resolve(process.cwd()),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0 && !optional) {
    process.exit(result.status ?? 1);
  }
  return result.status === 0;
}

async function testConnection() {
  const { resolveDatabaseUrl } = await import("../src/lib/db/resolve-database-url");
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL not set. Run npm run env:use-local-db or npm run env:use-neon-db");
    process.exit(1);
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log("Database connection OK.");
  } catch (error) {
    console.error("Cannot connect to database:", error instanceof Error ? error.message : error);
    console.error("\nOptions:");
    console.error("  A) Install Docker Desktop → npm run setup:local");
    console.error("  B) Free Neon Postgres → https://console.neon.tech → npm run env:use-neon-db");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("Headsbase ATS — database setup (production-safe)\n");
  await testConnection();
  run("npx prisma db push --skip-generate");
  if (!run("npm run db:generate", true)) {
    console.warn(`
Prisma generate skipped (file locked — common on OneDrive or while dev:lan is running).
If the app starts fine, you can ignore this. Otherwise:
  1. Stop npm run dev:lan
  2. Pause OneDrive sync for this folder
  3. Run: npm run db:generate
`);
  }

  if (includeDemo) {
    run("cross-env SEED_DEMO_DATA=1 npm run db:seed");
    run("npm run test:smoke");
    console.log("\nDemo data loaded.");
    console.log("  Login: demo@headsbase.com / demo12345");
  } else {
    console.log("\nSchema ready. No demo data was added.");
    console.log("Create your organization and admin account at /sign-up on first launch.");
    console.log("Back up before making changes: npm run backup");
  }

  console.log("\nStart the app:");
  console.log("  npm run dev:lan");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
