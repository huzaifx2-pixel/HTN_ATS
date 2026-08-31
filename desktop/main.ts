import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ensureDataDirectories, getAppRoot, getDataRoot, setAppRoot } from "./paths";
import { log } from "./logger";
import { findAvailablePort } from "./port-finder";
import {
  resolveDesktopConfig,
  markFirstRunComplete,
  isFirstRun,
  type DesktopConfig,
} from "./config-manager";
import { PostgresManager, hasBundledPostgres } from "./postgres-manager";
import {
  validatePostgresBundle,
  formatPostgresValidationError,
} from "./postgres-binaries";
import { BackendManager, resolveDatabaseUrl } from "./backend-manager";
import { createBackup, restoreBackup } from "./backup";

let mainWindow: BrowserWindow | null = null;
let postgresManager: PostgresManager | null = null;
let backendManager: BackendManager | null = null;
let desktopConfig: DesktopConfig | null = null;
let shuttingDown = false;
let backendRestartAttempts = 0;

const MAX_BACKEND_RESTARTS = 3;

/** Must be checked before any PostgreSQL, migrations, or BrowserWindow startup. */
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

process.env.HEADSBASE_DATA_DIR = getDataRoot();
setAppRoot(app.isPackaged ? path.dirname(app.getAppPath()) : path.resolve(__dirname, "..", ".."));
process.env.HEADSBASE_APP_ROOT = getAppRoot();

async function createWindow(url: string) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Headsbase ATS",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  await mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showFatalError(title: string, message: string) {
  log.error(message);
  dialog.showErrorBox(title, message);
}

function wireBackendCrashRecovery(config: DesktopConfig, databaseUrl: string) {
  backendManager?.onExit(async (code, signal) => {
    if (shuttingDown || code === 0) return;

    log.error("Backend crashed unexpectedly", { code, signal, backendRestartAttempts });

    if (backendRestartAttempts >= MAX_BACKEND_RESTARTS) {
      showFatalError(
        "Headsbase ATS — Backend Error",
        "The application backend stopped unexpectedly and could not be restarted.\n\n" +
          "Try closing and reopening Headsbase ATS. If the problem persists, check logs/error.log " +
          "or restore from a backup in %LOCALAPPDATA%\\HeadsbaseATS\\backups."
      );
      return;
    }

    backendRestartAttempts += 1;
    try {
      backendManager = new BackendManager(config, databaseUrl);
      wireBackendCrashRecovery(config, databaseUrl);
      const url = await backendManager.start();
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadURL(url);
      }
      log.app("Backend restarted after crash", { attempt: backendRestartAttempts });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restart the application backend.";
      showFatalError("Headsbase ATS — Recovery Failed", message);
    }
  });
}

async function startup(): Promise<void> {
  ensureDataDirectories();
  log.app("Headsbase ATS desktop starting", { dataRoot: getDataRoot(), packaged: app.isPackaged });

  const config = await resolveDesktopConfig(findAvailablePort);
  desktopConfig = config;

  const useBundled = hasBundledPostgres();
  if (useBundled) {
    const validation = validatePostgresBundle();
    if (!validation.ok) {
      throw new Error(formatPostgresValidationError(validation));
    }
    for (const warning of validation.warnings) {
      log.warn(warning);
    }
  }

  const databaseUrl = resolveDatabaseUrl(config, useBundled);

  if (useBundled) {
    postgresManager = new PostgresManager(config);
    await postgresManager.start();
  } else if (process.env.DATABASE_URL) {
    log.warn("Bundled PostgreSQL not found; using DATABASE_URL from environment (dev mode)");
  } else {
    throw new Error(
      "PostgreSQL is not available.\n\n" +
        "Place PostgreSQL binaries in resources/postgresql/ (see docs/DESKTOP_POSTGRESQL.md) " +
        "or set DATABASE_URL for development."
    );
  }

  backendManager = new BackendManager(config, databaseUrl);
  wireBackendCrashRecovery(config, databaseUrl);

  await backendManager.runMigrations();
  if (isFirstRun()) {
    log.app("First run complete — migrations applied");
    markFirstRunComplete();
  }

  const url = await backendManager.start();
  log.app("Application ready", { url });
  await createWindow(url);
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.app("Shutting down Headsbase ATS");

  try {
    await backendManager?.stop();
    await postgresManager?.stop();
    log.app("Shutdown complete");
  } catch (error) {
    log.error("Error during shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  app.exit(exitCode);
}

app.on("second-instance", () => {
  log.app("Second instance blocked — focusing existing window");
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  ipcMain.handle("headsbase:create-backup", async () => {
    if (!desktopConfig) throw new Error("Application not ready");
    return createBackup(desktopConfig, "user-request");
  });

  ipcMain.handle("headsbase:restore-backup", async (_event, backupDir: string) => {
    if (!desktopConfig) throw new Error("Application not ready");
    restoreBackup(backupDir, desktopConfig);
    return true;
  });

  try {
    await startup();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while starting the application.";
    showFatalError("Headsbase ATS — Startup Error", message);
    await shutdown(1);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void shutdown(0);
  }
});

app.on("before-quit", (event) => {
  if (!shuttingDown) {
    event.preventDefault();
    void shutdown(0);
  }
});

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
