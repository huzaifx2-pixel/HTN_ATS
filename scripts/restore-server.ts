/**
 * Restore PostgreSQL + uploads from a backup folder.
 * Usage: npm run backup:list
 *        npm run backup:restore -- 2026-08-12T12-00-00-000Z-manual --confirm
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function copyDirRecursive(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else copyFileSync(from, to);
  }
}

function listBackups(backupsRoot: string): string[] {
  if (!existsSync(backupsRoot)) return [];
  return readdirSync(backupsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

function restoreDatabase(dumpPath: string): boolean {
  const input = readFileSync(dumpPath);
  const result = spawnSync(
    "docker compose exec -T postgres pg_restore -U postgres -d headsbase_ats --clean --if-exists --no-owner --no-acl",
    {
      shell: true,
      cwd: resolve(process.cwd()),
      input,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );
  return result.status === 0;
}

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const backupName = args.find((arg) => !arg.startsWith("--"));

const dataRoot = resolve(process.cwd(), process.env.HEADSBASE_DATA_DIR || "./data");
const backupsRoot = join(dataRoot, "backups");
const uploadsDir = resolve(
  process.cwd(),
  process.env.STORAGE_LOCAL_PATH || join(dataRoot, "uploads")
);

if (!backupName) {
  const backups = listBackups(backupsRoot);
  console.log("Available backups:\n");
  if (backups.length === 0) {
    console.log("  (none — run npm run backup first)");
    process.exit(0);
  }
  for (const name of backups) {
    const manifestPath = join(backupsRoot, name, "backup.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        createdAt: string;
        includesDatabase: boolean;
        uploadsBytes: number;
      };
      console.log(
        `  ${name}  db=${manifest.includesDatabase ? "yes" : "no"}  uploads=${manifest.uploadsBytes}B  ${manifest.createdAt}`
      );
    } else {
      console.log(`  ${name}`);
    }
  }
  console.log("\nRestore with:");
  console.log(`  npm run backup:restore -- ${backups[0]} --confirm`);
  process.exit(0);
}

const backupDir = join(backupsRoot, backupName);
if (!existsSync(backupDir)) {
  console.error(`Backup not found: ${backupDir}`);
  process.exit(1);
}

if (!confirm) {
  console.error("Restore overwrites live data. Re-run with --confirm to proceed:");
  console.error(`  npm run backup:restore -- ${backupName} --confirm`);
  process.exit(1);
}

console.log(`Restoring from ${backupDir}\n`);

const dumpPath = join(backupDir, "database.dump");
if (existsSync(dumpPath)) {
  console.log("Restoring database...");
  if (!restoreDatabase(dumpPath)) {
    console.error("Database restore failed.");
    process.exit(1);
  }
  console.log("Database restored.");
} else {
  console.warn("No database.dump in backup — skipped database restore.");
}

const uploadsBackup = join(backupDir, "uploads");
if (existsSync(uploadsBackup)) {
  if (existsSync(uploadsDir)) {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
  copyDirRecursive(uploadsBackup, uploadsDir);
  console.log(`Uploads restored to ${uploadsDir}`);
}

console.log("\nRestore complete. Restart the app if it is running.");
