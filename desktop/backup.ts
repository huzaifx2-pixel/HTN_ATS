import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DesktopConfig } from "./config-manager";
import {
  getBackupsDir,
  getDataRoot,
  getPostgresBinDir,
  getUploadsDir,
} from "./paths";
import { log } from "./logger";
import { hasBundledPostgres } from "./postgres-manager";

function pgBin(name: string): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getPostgresBinDir(), `${name}${ext}`);
}

export function createBackup(config: DesktopConfig, label = "manual"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(getBackupsDir(), `${timestamp}-${label}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const uploadsSrc = getUploadsDir();
  if (fs.existsSync(uploadsSrc)) {
    copyDirRecursive(uploadsSrc, path.join(backupDir, "uploads"));
  }

  const configSrc = path.join(getDataRoot(), "config");
  if (fs.existsSync(configSrc)) {
    copyDirRecursive(configSrc, path.join(backupDir, "config"));
  }

  const dumpPath = path.join(backupDir, "database.dump");
  if (hasBundledPostgres() && fs.existsSync(pgBin("pg_dump"))) {
    try {
      execFileSync(
        pgBin("pg_dump"),
        [
          "-h",
          "127.0.0.1",
          "-p",
          String(config.postgresPort),
          "-U",
          config.postgresUser,
          "-F",
          "c",
          "-f",
          dumpPath,
          config.databaseName,
        ],
        {
          stdio: "pipe",
          env: { ...process.env, PGPASSWORD: config.postgresPassword },
        }
      );
      log.app("Database dump included in backup", { dumpPath });
    } catch (error) {
      log.error("pg_dump failed — backup contains files/config only", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    log.warn("pg_dump unavailable — backup contains files and config only");
  }

  const marker = {
    createdAt: new Date().toISOString(),
    label,
    includesDatabase: fs.existsSync(dumpPath),
    version: "1",
  };
  fs.writeFileSync(path.join(backupDir, "backup.json"), JSON.stringify(marker, null, 2), "utf8");
  log.app("Backup created", { backupDir });
  return backupDir;
}

/**
 * Restore uploads, config, and database from a backup directory.
 * Requires PostgreSQL to be running. Does not drop the cluster — restores into existing DB.
 */
export function restoreBackup(backupDir: string, config: DesktopConfig): void {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory not found: ${backupDir}`);
  }

  const metaPath = path.join(backupDir, "backup.json");
  if (!fs.existsSync(metaPath)) {
    throw new Error("Invalid backup: missing backup.json");
  }

  const uploadsBackup = path.join(backupDir, "uploads");
  if (fs.existsSync(uploadsBackup)) {
    const uploadsDest = getUploadsDir();
    fs.rmSync(uploadsDest, { recursive: true, force: true });
    copyDirRecursive(uploadsBackup, uploadsDest);
    log.app("Restored uploads from backup");
  }

  const configBackup = path.join(backupDir, "config");
  if (fs.existsSync(configBackup)) {
    const configDest = path.join(getDataRoot(), "config");
    fs.rmSync(configDest, { recursive: true, force: true });
    copyDirRecursive(configBackup, configDest);
    log.app("Restored configuration from backup");
  }

  const dumpPath = path.join(backupDir, "database.dump");
  if (fs.existsSync(dumpPath) && hasBundledPostgres() && fs.existsSync(pgBin("pg_restore"))) {
    execFileSync(
      pgBin("pg_restore"),
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(config.postgresPort),
        "-U",
        config.postgresUser,
        "-d",
        config.databaseName,
        "--clean",
        "--if-exists",
        "--no-owner",
        dumpPath,
      ],
      {
        stdio: "pipe",
        env: { ...process.env, PGPASSWORD: config.postgresPassword },
      }
    );
    log.app("Restored database from backup dump");
  } else if (fs.existsSync(dumpPath)) {
    log.warn("pg_restore unavailable — database not restored from dump");
  }

  log.app("Backup restore completed", { backupDir });
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

/** Documented restore steps for support and testing. */
export const RESTORE_INSTRUCTIONS = `
1. Close Headsbase ATS.
2. Optional: rename %LOCALAPPDATA%\\HeadsbaseATS\\postgres to postgres.bak
3. Open Headsbase ATS (PostgreSQL re-inits only if postgres/ is missing).
4. Use Settings → Restore or ipc restore with backup folder path.
5. Restart the application.
`.trim();
