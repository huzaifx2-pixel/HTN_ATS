import { spawn, ChildProcess, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DesktopConfig } from "./config-manager";
import { buildRuntimeEnv, getDatabaseUrl, isFirstRun } from "./config-manager";
import { getAppRoot, getDataRoot, getStandaloneDir, getPrismaDir, getResourcesPath } from "./paths";
import { log } from "./logger";
import { waitForHttp } from "./port-finder";

export type BackendExitHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

export class BackendManager {
  private process: ChildProcess | null = null;
  private exitHandler: BackendExitHandler | null = null;

  constructor(
    private readonly config: DesktopConfig,
    private readonly databaseUrl: string
  ) {}

  onExit(handler: BackendExitHandler): void {
    this.exitHandler = handler;
  }

  private findPrismaCli(): string | null {
    const candidates = [
      path.join(getResourcesPath(), "prisma-cli", "node_modules", "prisma", "build", "index.js"),
      path.join(getAppRoot(), "node_modules", "prisma", "build", "index.js"),
      path.join(getStandaloneDir(), "node_modules", "prisma", "build", "index.js"),
    ];
    for (const cli of candidates) {
      if (fs.existsSync(cli)) return cli;
    }
    return null;
  }

  private getPrismaModulesRoot(): string {
    const bundled = path.join(getResourcesPath(), "prisma-cli", "node_modules");
    if (fs.existsSync(bundled)) return bundled;
    return path.join(getAppRoot(), "node_modules");
  }

  private resolveSchemaPath(): string {
    const candidates = [
      path.join(getAppRoot(), "prisma", "schema.prisma"),
      path.join(getPrismaDir(), "schema.prisma"),
      path.join(getStandaloneDir(), "prisma", "schema.prisma"),
    ];
    for (const schema of candidates) {
      if (fs.existsSync(schema)) return schema;
    }
    throw new Error("Prisma schema not found in packaged application");
  }

  private runPrismaCommand(
    prismaCli: string,
    schemaPath: string,
    args: string[],
    env: NodeJS.ProcessEnv
  ): void {
    execFileSync(process.execPath, [prismaCli, ...args, "--schema", schemaPath], {
      cwd: path.dirname(prismaCli),
      env,
      stdio: "pipe",
      timeout: 180_000,
    });
  }

  async runMigrations(): Promise<void> {
    const prismaCli = this.findPrismaCli();
    if (!prismaCli) {
      throw new Error(
        "Prisma CLI not found in packaged application. Rebuild with npm run desktop:build."
      );
    }

    const schemaPath = this.resolveSchemaPath();
    const appRoot = getAppRoot();
    const env = {
      ...buildRuntimeEnv(this.config, getDataRoot(), appRoot, this.databaseUrl),
      NODE_PATH: this.getPrismaModulesRoot(),
      ELECTRON_RUN_AS_NODE: "1",
    };

    try {
      if (isFirstRun()) {
        log.app("First run — creating database schema", { schemaPath, prismaCli });
        this.runPrismaCommand(prismaCli, schemaPath, ["db", "push", "--skip-generate"], env);

        const migrationsDir = path.join(path.dirname(schemaPath), "migrations");
        if (fs.existsSync(migrationsDir)) {
          for (const entry of fs.readdirSync(migrationsDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            try {
              this.runPrismaCommand(
                prismaCli,
                schemaPath,
                ["migrate", "resolve", "--applied", entry.name],
                env
              );
            } catch (error) {
              log.warn("Could not mark migration as applied (non-fatal)", {
                migration: entry.name,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
        log.app("Database schema created successfully");
      } else {
        log.app("Running database migrations (pending only)", { schemaPath, prismaCli });
        this.runPrismaCommand(prismaCli, schemaPath, ["migrate", "deploy"], env);
        log.app("Database migrations completed successfully");
      }
    } catch (error) {
      const detail =
        error instanceof Error && "stderr" in error
          ? String((error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr ?? error.message)
          : error instanceof Error
            ? error.message
            : String(error);
      log.error("Database migration failed", { detail });
      throw new Error(
        "Database migration failed. Your existing data was not dropped or reset.\n\n" +
          "Check logs/error.log for details. You may restore from a backup in %LOCALAPPDATA%\\HeadsbaseATS\\backups.\n\n" +
          detail.slice(0, 500)
      );
    }
  }

  async start(): Promise<string> {
    if (this.process) {
      return this.config.appUrl;
    }

    const standaloneDir = getStandaloneDir();
    const serverEntry = path.join(standaloneDir, "server.js");
    if (!fs.existsSync(serverEntry)) {
      throw new Error(
        `Next.js standalone server not found at ${serverEntry}. Run npm run build && npm run desktop:prepare first.`
      );
    }

    const env = buildRuntimeEnv(this.config, getDataRoot(), getAppRoot(), this.databaseUrl);
    log.backend("Starting Next.js standalone server", {
      port: this.config.appPort,
      cwd: standaloneDir,
    });

    this.process = spawn(process.execPath, [serverEntry], {
      cwd: standaloneDir,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) log.backend(line);
    });
    this.process.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) log.backend(line);
    });

    this.process.on("exit", (code, signal) => {
      log.error("Backend process exited", { code, signal });
      this.process = null;
      this.exitHandler?.(code, signal);
    });

    const url = this.config.appUrl;
    await waitForHttp(url);
    return url;
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    const proc = this.process;
    this.process = null;
    proc.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!proc.killed) proc.kill("SIGKILL");
    log.backend("Backend stopped");
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

export function resolveDatabaseUrl(config: DesktopConfig, useBundledPostgres: boolean): string {
  if (useBundledPostgres) return getDatabaseUrl(config);
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return getDatabaseUrl(config);
}
