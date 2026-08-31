import { spawn, ChildProcess, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DesktopConfig } from "./config-manager";
import { getPostgresBinDir, getPostgresDataDir, getTempDir } from "./paths";
import { log } from "./logger";

const VALID_DB_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class PostgresManager {
  private process: ChildProcess | null = null;

  constructor(private readonly config: DesktopConfig) {}

  private bin(name: string): string {
    const ext = process.platform === "win32" ? ".exe" : "";
    const bundled = path.join(getPostgresBinDir(), `${name}${ext}`);
    if (fs.existsSync(bundled)) return bundled;
    return name;
  }

  private pgData(): string {
    return getPostgresDataDir();
  }

  isInitialized(): boolean {
    return fs.existsSync(path.join(this.pgData(), "PG_VERSION"));
  }

  async start(): Promise<void> {
    const pgData = this.pgData();
    fs.mkdirSync(pgData, { recursive: true });

    if (!this.isInitialized()) {
      this.initializeCluster();
    }

    if (this.process) return;

    this.process = spawn(
      this.bin("postgres"),
      ["-D", pgData, "-p", String(this.config.postgresPort), "-h", "127.0.0.1"],
      {
        stdio: "ignore",
        env: { ...process.env, PGDATA: pgData },
      }
    );

    this.process.on("exit", (code, signal) => {
      log.warn("PostgreSQL process exited", { code, signal });
      this.process = null;
    });

    await this.waitUntilReady();
    await this.ensureDatabase();
    log.app("PostgreSQL started", { port: this.config.postgresPort, dataDir: pgData });
  }

  private initializeCluster(): void {
    log.app("Initializing embedded PostgreSQL data directory (first run only)");
    const pgData = this.pgData();
    const pwFile = path.join(getTempDir(), `pg-init-${Date.now()}.pw`);
    fs.writeFileSync(pwFile, `${this.config.postgresPassword}\n`, { mode: 0o600 });

    try {
      execFileSync(
        this.bin("initdb"),
        [
          "-D",
          pgData,
          "-U",
          this.config.postgresUser,
          "-A",
          "scram-sha-256",
          `--pwfile=${pwFile}`,
          "--encoding=UTF8",
          "--locale=C",
        ],
        {
          stdio: "pipe",
          env: { ...process.env, PGDATA: pgData },
        }
      );
    } finally {
      try {
        fs.unlinkSync(pwFile);
      } catch {
        // ignore
      }
    }

    this.hardenConfiguration();
  }

  /** Restrict PostgreSQL to localhost with password authentication. */
  private hardenConfiguration(): void {
    const pgData = this.pgData();
    const confPath = path.join(pgData, "postgresql.conf");
    const hbaPath = path.join(pgData, "pg_hba.conf");

    fs.appendFileSync(
      confPath,
      [
        "",
        "# Headsbase ATS desktop — localhost only",
        "listen_addresses = '127.0.0.1'",
        "",
      ].join("\n")
    );

    const hba = [
      "# Headsbase ATS desktop — localhost only",
      "local   all             all                                     scram-sha-256",
      "host    all             all             127.0.0.1/32            scram-sha-256",
      "host    all             all             ::1/128                 scram-sha-256",
      "",
    ].join("\n");
    fs.writeFileSync(hbaPath, hba, "utf8");
  }

  private async waitUntilReady(maxMs = 45_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      try {
        execFileSync(
          this.bin("pg_isready"),
          ["-h", "127.0.0.1", "-p", String(this.config.postgresPort), "-U", this.config.postgresUser],
          {
            stdio: "ignore",
            env: { ...process.env, PGPASSWORD: this.config.postgresPassword },
          }
        );
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    throw new Error("PostgreSQL failed to become ready within 45 seconds");
  }

  private async ensureDatabase(): Promise<void> {
    const dbName = this.config.databaseName;
    if (!VALID_DB_NAME.test(dbName)) {
      throw new Error(`Invalid database name: ${dbName}`);
    }

    const psqlEnv = {
      ...process.env,
      PGPASSWORD: this.config.postgresPassword,
    };

    let exists = false;
    try {
      const out = execFileSync(
        this.bin("psql"),
        [
          "-h",
          "127.0.0.1",
          "-p",
          String(this.config.postgresPort),
          "-U",
          this.config.postgresUser,
          "-d",
          "postgres",
          "-At",
          "-c",
          `SELECT 1 FROM pg_database WHERE datname='${dbName}'`,
        ],
        { stdio: "pipe", env: psqlEnv }
      );
      exists = out.toString().trim() === "1";
    } catch {
      exists = false;
    }

    if (exists) return;

    try {
      execFileSync(
        this.bin("createdb"),
        [
          "-h",
          "127.0.0.1",
          "-p",
          String(this.config.postgresPort),
          "-U",
          this.config.postgresUser,
          dbName,
        ],
        { stdio: "pipe", env: psqlEnv }
      );
      log.app("Created application database", { dbName });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already exists")) return;
      throw new Error(`Failed to create application database: ${message}`);
    }
  }

  async stop(): Promise<void> {
    const pgData = this.pgData();

    try {
      execFileSync(
        this.bin("pg_ctl"),
        ["stop", "-D", pgData, "-m", "fast", "-w"],
        { stdio: "ignore", timeout: 20_000 }
      );
      log.app("PostgreSQL stopped via pg_ctl");
    } catch {
      if (this.process) {
        const proc = this.process;
        this.process = null;
        proc.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!proc.killed) proc.kill("SIGKILL");
        log.app("PostgreSQL stopped via process signal");
      }
    }

    this.process = null;
  }
}

/** True when bundled PostgreSQL server binary is present. */
export function hasBundledPostgres(): boolean {
  const ext = process.platform === "win32" ? ".exe" : "";
  return fs.existsSync(path.join(getPostgresBinDir(), `postgres${ext}`));
}
