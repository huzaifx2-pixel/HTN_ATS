import fs from "node:fs";
import path from "node:path";
import { getLogsDir } from "./paths";

type LogLevel = "info" | "warn" | "error";

function write(fileName: string, level: LogLevel, message: string, meta?: unknown) {
  try {
    const dir = getLogsDir();
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...(meta !== undefined ? { meta } : {}),
    });
    fs.appendFileSync(path.join(dir, fileName), `${line}\n`, "utf8");
  } catch {
    // ignore
  }
}

export const log = {
  app(message: string, meta?: unknown) {
    write("application.log", "info", message, meta);
    console.log(`[app] ${message}`, meta ?? "");
  },
  backend(message: string, meta?: unknown) {
    write("backend.log", "info", message, meta);
    console.log(`[backend] ${message}`, meta ?? "");
  },
  warn(message: string, meta?: unknown) {
    write("application.log", "warn", message, meta);
    console.warn(`[warn] ${message}`, meta ?? "");
  },
  error(message: string, meta?: unknown) {
    write("error.log", "error", message, meta);
    write("application.log", "error", message, meta);
    console.error(`[error] ${message}`, meta ?? "");
  },
};
