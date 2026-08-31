import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_NAME = "HeadsbaseATS";

/** True when running as packaged desktop app (set by Electron main process). */
export function isDesktopRuntime(): boolean {
  return process.env.HEADSBASE_DESKTOP === "1";
}

/** Root directory for all persistent user data (outside install dir). */
export function getDataRoot(): string {
  if (process.env.HEADSBASE_DATA_DIR) {
    return process.env.HEADSBASE_DATA_DIR;
  }

  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    return path.join(base, APP_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }

  const xdg = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(xdg, APP_NAME);
}

export function getUploadsDir(): string {
  return process.env.STORAGE_LOCAL_PATH ?? path.join(getDataRoot(), "uploads");
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

/** Ensure all standard data directories exist. */
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

function firstExistingPath(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function findPdfParseWorkerDir(): string | null {
  const searchRoots = [
    path.join(process.cwd(), ".next", "node_modules"),
    path.join(process.cwd(), "node_modules"),
  ];
  if (process.env.HEADSBASE_APP_ROOT) {
    searchRoots.push(path.join(process.env.HEADSBASE_APP_ROOT, ".next", "node_modules"));
  }

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith("pdf-parse")) continue;
      const worker = path.join(root, entry, "dist", "worker", "pdf.worker.mjs");
      if (fs.existsSync(worker)) return worker;
    }
  }
  return null;
}

/** Resolve path to bundled app resources (skills CSV, pdf worker, etc.). */
export function getAppResourcePath(...segments: string[]): string {
  const cwdPath = path.join(process.cwd(), ...segments);
  if (fs.existsSync(cwdPath)) return cwdPath;

  if (process.env.HEADSBASE_APP_ROOT) {
    const rootPath = path.join(process.env.HEADSBASE_APP_ROOT, ...segments);
    if (fs.existsSync(rootPath)) return rootPath;
    return rootPath;
  }

  return cwdPath;
}

export function getSkillsCsvPath(): string {
  return firstExistingPath([
    path.join(process.cwd(), "src", "lib", "parsers", "data", "skills.csv"),
    getAppResourcePath("src", "lib", "parsers", "data", "skills.csv"),
    getBundledParserResourcePath("skills.csv"),
  ]);
}

function getBundledParserResourcePath(filename: string): string {
  if (process.env.HEADSBASE_RESOURCES_DIR) {
    const bundled = path.join(process.env.HEADSBASE_RESOURCES_DIR, "parser", filename);
    if (fs.existsSync(bundled)) return bundled;
  }
  return path.join(process.cwd(), "resources", "parser", filename);
}

export function getPdfWorkerPath(): string {
  const bundledWorker = findPdfParseWorkerDir();
  const candidates = [
    path.join(process.cwd(), "resources", "parser", "pdf.worker.mjs"),
    ...(bundledWorker ? [bundledWorker] : []),
    path.join(process.cwd(), "node_modules", "pdf-parse", "dist", "worker", "pdf.worker.mjs"),
    getBundledParserResourcePath("pdf.worker.mjs"),
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
    getAppResourcePath("node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs"),
  ];
  const resolved = firstExistingPath(candidates);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      "PDF worker not found. Run npm install and restart the server, or set HEADSBASE_RESOURCES_DIR.",
    );
  }
  return resolved;
}
