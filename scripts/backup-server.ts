/**
 * Backup PostgreSQL + uploaded files for the LAN/production server.
 * Usage: npm run backup
 *        npm run backup -- nightly
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { findPgBin, hasDocker, parseDatabaseUrl } from "./lib/postgres-detect";

config({ path: resolve(process.cwd(), ".env") });

function copyDirRecursive(src: string, dest: string) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else copyFileSync(from, to);
  }
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function dirSizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(full) : statSync(full).size;
  }
  return total;
}

function runDockerDump(dumpPath: string): boolean {
  const result = spawnSync(
    "docker compose exec -T postgres pg_dump -U postgres -Fc headsbase_ats",
    {
      shell: true,
      cwd: resolve(process.cwd()),
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (result.status !== 0 || !result.stdout?.length) {
    return false;
  }
  writeFileSync(dumpPath, result.stdout);
  return true;
}

function runNativeDump(dumpPath: string): boolean {
  const pgDump = findPgBin("pg_dump");
  const db = parseDatabaseUrl(process.env.DIRECT_URL || process.env.DATABASE_URL || "");
  if (!pgDump || !db) {
    return false;
  }

  const result = spawnSync(
    pgDump,
    [
      "-h",
      db.host,
      "-p",
      db.port,
      "-U",
      db.user,
      "-F",
      "c",
      "-f",
      dumpPath,
      db.database,
    ],
    {
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PGPASSWORD: db.password },
    }
  );
  if (result.status !== 0) {
    console.error("pg_dump failed:", result.stderr?.toString() || "unknown error");
    return false;
  }
  return existsSync(dumpPath);
}

function runDatabaseDump(dumpPath: string): boolean {
  if (hasDocker()) {
    const dockerOk = runDockerDump(dumpPath);
    if (dockerOk) return true;
  }
  return runNativeDump(dumpPath);
}

async function main() {
  const label = process.argv[2]?.trim() || "manual";
  const dataRoot = resolve(process.cwd(), process.env.HEADSBASE_DATA_DIR || "./data");
  const uploadsDir = resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_PATH || join(dataRoot, "uploads")
  );
  const backupsRoot = join(dataRoot, "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(backupsRoot, `${timestamp}-${label}`);

  mkdirSync(backupDir, { recursive: true });

  console.log(`Creating backup in ${backupDir}\n`);

  const dumpPath = join(backupDir, "database.dump");
  const dbOk = runDatabaseDump(dumpPath);

  if (existsSync(uploadsDir)) {
    copyDirRecursive(uploadsDir, join(backupDir, "uploads"));
    console.log(`Copied uploads from ${uploadsDir}`);
  } else {
    console.log("No uploads directory yet — skipped file backup.");
  }

  if (existsSync(resolve(process.cwd(), ".env"))) {
    copyFileSync(resolve(process.cwd(), ".env"), join(backupDir, "env.redacted.txt"));
    const envText = readFileSync(join(backupDir, "env.redacted.txt"), "utf8");
    const redacted = envText.replace(
      /^(BETTER_AUTH_SECRET|GOOGLE_CLIENT_SECRET|R2_SECRET_ACCESS_KEY|TELEGRAM_BOT_TOKEN)=.*$/gm,
      "$1=[REDACTED]"
    );
    writeFileSync(join(backupDir, "env.redacted.txt"), redacted, "utf8");
  }

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    label,
    includesDatabase: dbOk && existsSync(dumpPath),
    databaseBytes: existsSync(dumpPath) ? statSync(dumpPath).size : 0,
    uploadsBytes: dirSizeBytes(join(backupDir, "uploads")),
    uploadsPath: uploadsDir,
    databaseSha256: dbOk ? await sha256File(dumpPath) : null,
  };

  writeFileSync(join(backupDir, "backup.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log("\nBackup complete.");
  console.log(`  Database: ${manifest.includesDatabase ? "yes" : "NO — check Postgres/pg_dump"}`);
  console.log(`  Uploads: ${manifest.uploadsBytes} bytes`);
  console.log(`  Location: ${backupDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
