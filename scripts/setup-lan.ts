/**
 * Production LAN setup: Postgres + schema + durable data paths + network URL.
 * Works with Docker OR an existing native PostgreSQL install.
 *
 * Usage: npm run setup:lan
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  buildLocalDatabaseUrl,
  detectPostgresPort,
  hasDocker,
} from "./lib/postgres-detect";

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

console.log("Headsbase ATS — production LAN setup\n");
console.log("This keeps your data in persistent locations and skips demo seeding.\n");

async function ensurePostgres() {
  if (hasDocker()) {
    console.log("Docker found — starting Postgres container...\n");
    run("docker compose up -d");
    run("docker compose ps");

    console.log("\nWaiting for Postgres...");
    for (let i = 0; i < 30; i++) {
      if (run("docker compose exec -T postgres pg_isready -U postgres -d headsbase_ats", true)) {
        return "docker";
      }
      spawnSync("powershell", ["-Command", "Start-Sleep -Seconds 2"], { stdio: "inherit" });
    }
    console.error("Docker Postgres did not become ready in time.");
    process.exit(1);
  }

  const port = await detectPostgresPort();
  if (!port) {
    console.error(`
Docker is not installed and no PostgreSQL was found on ports 5433, 5432, or 5434.

Install PostgreSQL 17 (recommended for production LAN without Docker):
  winget install PostgreSQL.PostgreSQL.17

During install, note the postgres password. Then in pgAdmin or psql:
  CREATE DATABASE headsbase_ats;

If your password is not "postgres", edit DATABASE_URL in .env after setup.

Then re-run: npm run setup:lan
`);
    process.exit(1);
  }

  console.log(`Native PostgreSQL detected on port ${port} — using existing server.\n`);
  console.log(`  ${buildLocalDatabaseUrl(port)}\n`);
  return "native";
}

async function main() {
  const mode = await ensurePostgres();

  run("npm run env:use-local-db");
  run("npm run env:use-production");
  run("npm run setup:db");
  run("npm run env:use-lan-url");
  run("npm run backup", true);

  const dbNote =
    mode === "docker"
      ? '  Database  → Docker volume "headsbase_pgdata" (survives container restarts)'
      : "  Database  → your local PostgreSQL server (back up with npm run backup)";

  console.log(`
Production LAN setup complete.

Your data is stored in:
${dbNote}
  Uploads   → ./data/uploads
  Backups   → ./data/backups

Start the server:
  npm run dev:lan          (development)
  npm run build && npm run start:lan   (production)

First visit: open the LAN URL printed above → Sign up → create your organization.

Daily safety:
  npm run backup              before upgrades or schema changes
  npm run backup:list         list restore points
  npm run backup:restore -- <name> --confirm
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
