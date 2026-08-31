import fs from "node:fs";
import path from "node:path";
import { getLogsDir } from "@/lib/runtime/paths";

export type LogLevel = "info" | "warn" | "error";

function timestamp(): string {
  return new Date().toISOString();
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/password=\S+/gi, "password=[REDACTED]")
    .replace(/secret=\S+/gi, "secret=[REDACTED]");
}

function writeLog(fileName: string, level: LogLevel, message: string, meta?: unknown) {
  try {
    const logsDir = getLogsDir();
    fs.mkdirSync(logsDir, { recursive: true });
    const line = JSON.stringify({
      time: timestamp(),
      level,
      message: sanitizeMessage(message),
      ...(meta !== undefined ? { meta } : {}),
    });
    fs.appendFileSync(path.join(logsDir, fileName), `${line}\n`, "utf8");
  } catch {
    // Never crash the app because logging failed.
  }
}

export const appLogger = {
  info(message: string, meta?: unknown) {
    writeLog("application.log", "info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    writeLog("application.log", "warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    writeLog("error.log", "error", message, meta);
    writeLog("application.log", "error", message, meta);
  },
};

export const backendLogger = {
  info(message: string, meta?: unknown) {
    writeLog("backend.log", "info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    writeLog("backend.log", "warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    writeLog("error.log", "error", message, meta);
    writeLog("backend.log", "error", message, meta);
  },
};
