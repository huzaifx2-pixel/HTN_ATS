import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_NAME = "Headsbase ATS";
export const APP_ID = "com.headsbase.ats";

export function getDataRoot(): string {
  if (process.env.HEADSBASE_DATA_DIR) {
    return process.env.HEADSBASE_DATA_DIR;
  }
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "HeadsbaseATS");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "HeadsbaseATS");
  }
  const xdg = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(xdg, "HeadsbaseATS");
}

export function getUploadsDir(): string {
  return path.join(getDataRoot(), "uploads");
}

export function getLogsDir(): string {
  return path.join(getDataRoot(), "logs");
}

export function getBackupsDir(): string {
  return path.join(getDataRoot(), "backups");
}

export function getConfigDir(): string {
  return path.join(getDataRoot(), "config");
}

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), "app.env");
}

export function getPostgresDataDir(): string {
  return path.join(getDataRoot(), "postgres");
}

export function getTempDir(): string {
  return path.join(getDataRoot(), "temp");
}

export function ensureDataDirectories(): void {
  for (const dir of [
    getDataRoot(),
    getUploadsDir(),
    getLogsDir(),
    getBackupsDir(),
    getConfigDir(),
    getPostgresDataDir(),
    getTempDir(),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let appRootOverride: string | null = null;

export function setAppRoot(root: string): void {
  appRootOverride = root;
}

/** Installation root (contains .next/standalone when packaged). */
export function getAppRoot(): string {
  if (process.env.HEADSBASE_APP_ROOT) {
    return process.env.HEADSBASE_APP_ROOT;
  }
  if (appRootOverride) {
    return appRootOverride;
  }
  return path.resolve(__dirname, "..", "..");
}

/** Resolve standalone server directory (handles packaged extraResources layout). */
export function getStandaloneDir(): string {
  const root = getAppRoot();
  const candidates = [
    path.join(getResourcesPath(), "standalone"),
    path.join(root, "app.asar.unpacked", ".next", "standalone"),
    path.join(root.replace(/app\.asar(?=$|[\\/])/, "app.asar.unpacked"), ".next", "standalone"),
    path.join(root, ".next", "standalone"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "server.js"))) return dir;
  }
  return path.join(getResourcesPath(), "standalone");
}

export function getResourcesPath(): string {
  return process.resourcesPath ?? path.join(getAppRoot(), "resources");
}

export function getPostgresBinDir(): string {
  return path.join(getResourcesPath(), "postgresql", "bin");
}

export function getPrismaDir(): string {
  return path.join(getResourcesPath(), "prisma");
}

export function isDevDesktop(): boolean {
  return process.env.HEADSBASE_DESKTOP_DEV === "1";
}
