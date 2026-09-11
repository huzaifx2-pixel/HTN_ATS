import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

function parseDbTarget(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || "5432"),
      database: parsed.pathname.replace(/^\//, "").split("?")[0] || "",
    };
  } catch {
    return null;
  }
}

function tcpOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function startPg17(): { ok: boolean; detail: string } {
  const pgCtl = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_ctl.exe";
  const dataDir = "C:\\Program Files\\PostgreSQL\\17\\data";
  if (!existsSync(pgCtl) || !existsSync(dataDir)) {
    return { ok: false, detail: "pg17 binaries or data dir missing" };
  }
  const status = spawnSync(pgCtl, ["status", "-D", dataDir], { encoding: "utf8", windowsHide: true });
  const statusText = `${status.stdout ?? ""} ${status.stderr ?? ""}`.trim();
  if (status.status === 0 && /server is running/i.test(statusText)) {
    return { ok: true, detail: statusText.slice(0, 200) };
  }
  const started = spawnSync(pgCtl, ["start", "-D", dataDir, "-w", "-t", "30"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const detail = `${started.stdout ?? ""} ${started.stderr ?? ""}`.trim().slice(0, 400);
  return { ok: started.status === 0, detail: detail || `exit ${started.status}` };
}

/** If local ATS Postgres (127.0.0.1:5433) is down, start the PG17 cluster. */
export async function ensureLocalPostgres(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim() || "";
  const target = parseDbTarget(url);

  if (!target) return;
  const local =
    (target.host === "127.0.0.1" || target.host === "localhost") && target.port === 5433;
  if (!local) return;

  const open5433 = await tcpOpen("127.0.0.1", 5433);
  if (open5433) return;

  const result = startPg17();
  const openAfter = await tcpOpen("127.0.0.1", 5433, 3000);
  if (openAfter) {
    console.info("[db] Started local PostgreSQL 17 on 127.0.0.1:5433");
  } else {
    console.error("[db] Cannot reach 127.0.0.1:5433. Start PostgreSQL 17 or run:");
    console.error(
      '  & "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_ctl.exe" start -D "C:\\Program Files\\PostgreSQL\\17\\data" -w',
    );
    if (result.detail) console.error(`[db] ${result.detail}`);
  }
}
