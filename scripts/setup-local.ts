/**
 * Full local bootstrap when Docker is available.
 * Usage: npm run setup:local
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

function run(cmd: string, optional = false) {
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

function hasDocker() {
  return run("docker --version", true);
}

console.log("Headsbase ATS — local setup\n");

if (!hasDocker()) {
  console.error(`
Docker is not installed or not in PATH.

Choose one of these alternatives:

  OPTION A — Neon (free cloud Postgres, no install):
    1. Sign up at https://console.neon.tech
    2. Create a project → Connect → copy pooled + direct URLs
    3. Run:
       npm run env:use-neon-db -- "POOLED_URL" "DIRECT_URL"
       npm run setup:db

  OPTION B — Install Docker Desktop:
    https://www.docker.com/products/docker-desktop/
    Then re-run: npm run setup:local

  OPTION C — Install PostgreSQL 17 (Windows):
    winget install PostgreSQL.PostgreSQL.17
    Create database "headsbase_ats", then:
    npm run env:use-local-db
    npm run setup:db
`);
  process.exit(1);
}

run("docker compose up -d");
run("docker compose ps");

console.log("\nWaiting for Postgres...");
for (let i = 0; i < 30; i++) {
  if (run("docker compose exec -T postgres pg_isready -U postgres -d headsbase_ats", true)) break;
  spawnSync("powershell", ["-Command", "Start-Sleep -Seconds 2"], { stdio: "inherit" });
}

run("npm run env:use-local-db");
run("npm run setup:db:demo");
