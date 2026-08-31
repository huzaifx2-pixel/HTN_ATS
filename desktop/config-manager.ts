import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  getConfigDir,
  getConfigFilePath,
  getPostgresDataDir,
  getUploadsDir,
  getResourcesPath,
} from "./paths";
import { log } from "./logger";

export type DesktopConfig = {
  appPort: number;
  postgresPort: number;
  databaseName: string;
  postgresUser: string;
  postgresPassword: string;
  authSecret: string;
  appUrl: string;
};

const DEFAULTS = {
  appPort: 17345,
  postgresPort: 54329,
  databaseName: "headsbase_ats",
  postgresUser: "headsbase",
};

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function serializeEnv(vars: Record<string, string>): string {
  const header = [
    "# Headsbase ATS desktop configuration — generated automatically",
    "# Do not commit this file. User data lives outside the install directory.",
    "",
  ].join("\n");
  const body = Object.entries(vars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return `${header}${body}\n`;
}

function requireField(parsed: Record<string, string>, key: string): string {
  const value = parsed[key];
  if (!value) {
    throw new Error(
      `Desktop configuration is incomplete (missing ${key}). ` +
        `Repair ${getConfigFilePath()} or rename it to regenerate on next launch.`
    );
  }
  return value;
}

function configFromParsed(parsed: Record<string, string>): DesktopConfig {
  const appPort = Number(parsed.HEADSBASE_APP_PORT ?? DEFAULTS.appPort);
  const postgresPort = Number(parsed.HEADSBASE_POSTGRES_PORT ?? DEFAULTS.postgresPort);
  return {
    appPort,
    postgresPort,
    databaseName: parsed.HEADSBASE_DB_NAME ?? DEFAULTS.databaseName,
    postgresUser: parsed.HEADSBASE_DB_USER ?? DEFAULTS.postgresUser,
    postgresPassword: requireField(parsed, "HEADSBASE_DB_PASSWORD"),
    authSecret: requireField(parsed, "BETTER_AUTH_SECRET"),
    appUrl: parsed.BETTER_AUTH_URL ?? `http://127.0.0.1:${appPort}`,
  };
}

function createInitialConfig(): DesktopConfig {
  const appPort = DEFAULTS.appPort;
  return {
    appPort,
    postgresPort: DEFAULTS.postgresPort,
    databaseName: DEFAULTS.databaseName,
    postgresUser: DEFAULTS.postgresUser,
    postgresPassword: crypto.randomBytes(16).toString("hex"),
    authSecret: crypto.randomBytes(32).toString("hex"),
    appUrl: `http://127.0.0.1:${appPort}`,
  };
}

/** Persist configuration to user data directory. Never writes to install dir. */
export function saveConfig(config: DesktopConfig): void {
  fs.mkdirSync(getConfigDir(), { recursive: true });
  const envContent = serializeEnv({
    HEADSBASE_DESKTOP: "1",
    HEADSBASE_APP_PORT: String(config.appPort),
    HEADSBASE_POSTGRES_PORT: String(config.postgresPort),
    HEADSBASE_DB_NAME: config.databaseName,
    HEADSBASE_DB_USER: config.postgresUser,
    HEADSBASE_DB_PASSWORD: config.postgresPassword,
    BETTER_AUTH_SECRET: config.authSecret,
    BETTER_AUTH_URL: config.appUrl,
    STORAGE_PROVIDER: "local",
    WEBSITE_JOB_SYNC_ENABLED: "false",
    GMAIL_SYNC_ENABLED: "false",
    TELEGRAM_NOTIFICATIONS_ENABLED: "false",
    RESUME_PARSER_PROVIDER: "local",
    NODE_ENV: "production",
  });
  fs.writeFileSync(getConfigFilePath(), envContent, "utf8");
}

/** Load existing config or create a new one on first run. Does not regenerate secrets. */
export function loadOrCreateConfig(): DesktopConfig {
  const configPath = getConfigFilePath();
  fs.mkdirSync(getConfigDir(), { recursive: true });

  if (fs.existsSync(configPath)) {
    const parsed = parseEnvFile(fs.readFileSync(configPath, "utf8"));
    return configFromParsed(parsed);
  }

  const config = createInitialConfig();
  saveConfig(config);
  log.app("Created default desktop configuration", { configPath });
  return config;
}

/**
 * Resolve application and PostgreSQL ports, persisting changes when ports shift.
 * Existing PostgreSQL data is never re-initialized when ports change.
 */
export async function resolveDesktopConfig(
  findPort: (preferred: number) => Promise<number>
): Promise<DesktopConfig> {
  const config = loadOrCreateConfig();
  const clusterInitialized = fs.existsSync(path.join(getPostgresDataDir(), "PG_VERSION"));

  // Keep persisted ports when cluster already exists (ports may appear busy because we own them)
  const postgresPort = clusterInitialized
    ? config.postgresPort || DEFAULTS.postgresPort
    : await findPort(config.postgresPort || DEFAULTS.postgresPort);
  const appPort = clusterInitialized
    ? config.appPort || DEFAULTS.appPort
    : await findPort(config.appPort || DEFAULTS.appPort);
  const appUrl = `http://127.0.0.1:${appPort}`;

  const resolved: DesktopConfig = {
    ...config,
    postgresPort,
    appPort,
    appUrl,
  };

  if (
    postgresPort !== config.postgresPort ||
    appPort !== config.appPort ||
    appUrl !== config.appUrl
  ) {
    saveConfig(resolved);
    log.app("Updated desktop ports in configuration", { postgresPort, appPort });
  }

  return resolved;
}

export function buildRuntimeEnv(
  config: DesktopConfig,
  dataRoot: string,
  appRoot: string,
  databaseUrl: string
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HEADSBASE_DESKTOP: "1",
    HEADSBASE_DATA_DIR: dataRoot,
    HEADSBASE_APP_ROOT: appRoot,
    HEADSBASE_RESOURCES_DIR: getResourcesPath(),
    HEADSBASE_APP_URL: config.appUrl,
    PORT: String(config.appPort),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    BETTER_AUTH_SECRET: config.authSecret,
    BETTER_AUTH_URL: config.appUrl,
    STORAGE_PROVIDER: "local",
    STORAGE_LOCAL_PATH: getUploadsDir(),
    WEBSITE_JOB_SYNC_ENABLED: "false",
    GMAIL_SYNC_ENABLED: "false",
    TELEGRAM_NOTIFICATIONS_ENABLED: "false",
    RESUME_PARSER_PROVIDER: "local",
    NODE_ENV: "production",
  };
}

export function getDatabaseUrl(config: DesktopConfig): string {
  return `postgresql://${encodeURIComponent(config.postgresUser)}:${encodeURIComponent(config.postgresPassword)}@127.0.0.1:${config.postgresPort}/${config.databaseName}`;
}

export function getPostgresDataPath(): string {
  return getPostgresDataDir();
}

export function markFirstRunComplete(): void {
  const marker = path.join(getConfigDir(), ".initialized");
  fs.writeFileSync(marker, new Date().toISOString(), "utf8");
}

export function isFirstRun(): boolean {
  return !fs.existsSync(path.join(getConfigDir(), ".initialized"));
}
