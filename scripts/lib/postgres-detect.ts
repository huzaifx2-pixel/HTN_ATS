import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import net from "node:net";

export function hasDocker(): boolean {
  const result = spawnSync("docker --version", {
    shell: true,
    stdio: "ignore",
  });
  return result.status === 0;
}

export function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** Common local Postgres ports: native installs and Docker compose. */
export async function detectPostgresPort(): Promise<number | null> {
  for (const port of [5433, 5432, 5434]) {
    if (await isPortOpen(port)) return port;
  }
  return null;
}

export function buildLocalDatabaseUrl(port: number): string {
  return `postgresql://postgres:postgres@localhost:${port}/headsbase_ats`;
}

export function findPgBin(name: string): string | null {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", [exe], {
    encoding: "utf8",
  });
  if (which.status === 0) {
    const first = which.stdout.trim().split(/\r?\n/)[0];
    if (first) return first;
  }

  if (process.platform === "win32") {
    const base = "C:\\Program Files\\PostgreSQL";
    if (existsSync(base)) {
      for (const version of readdirSync(base)) {
        const candidate = path.join(base, version, "bin", exe);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

export function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}
