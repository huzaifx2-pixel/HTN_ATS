import fs from "node:fs";
import path from "node:path";
import { getPostgresBinDir, getResourcesPath } from "./paths";

/** Core executables required for embedded PostgreSQL on Windows. */
export const REQUIRED_POSTGRES_BINARIES = [
  "postgres",
  "initdb",
  "pg_ctl",
  "pg_isready",
  "psql",
  "createdb",
  "pg_dump",
  "pg_restore",
] as const;

export type PostgresValidationResult = {
  ok: boolean;
  missing: string[];
  warnings: string[];
  binDir: string;
  resourcesRoot: string;
};

/**
 * Validates bundled PostgreSQL layout.
 *
 * Required layout:
 *   resources/postgresql/
 *     bin/     — executables + Windows DLLs (copy entire bin from PG install)
 *     lib/     — extension libraries
 *     share/   — timezone/locale data for initdb
 */
export function validatePostgresBundle(): PostgresValidationResult {
  const resourcesRoot = path.join(getResourcesPath(), "postgresql");
  const binDir = getPostgresBinDir();
  const ext = process.platform === "win32" ? ".exe" : "";
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const name of REQUIRED_POSTGRES_BINARIES) {
    const full = path.join(binDir, `${name}${ext}`);
    if (!fs.existsSync(full)) {
      missing.push(`${name}${ext}`);
    }
  }

  const libDir = path.join(resourcesRoot, "lib");
  const shareDir = path.join(resourcesRoot, "share");
  if (!fs.existsSync(libDir)) {
    warnings.push("Missing postgresql/lib — initdb may fail without extension libraries");
  }
  if (!fs.existsSync(shareDir)) {
    warnings.push("Missing postgresql/share — initdb may fail without timezone/locale data");
  }

  if (process.platform === "win32" && fs.existsSync(binDir)) {
    const dlls = fs.readdirSync(binDir).filter((f) => f.toLowerCase().endsWith(".dll"));
    if (dlls.length < 5) {
      warnings.push(
        `Only ${dlls.length} DLL(s) found in postgresql/bin — copy the full bin folder from a PostgreSQL Windows install (typically 30+ DLLs)`
      );
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    binDir,
    resourcesRoot,
  };
}

export function formatPostgresValidationError(result: PostgresValidationResult): string {
  const lines = [
    "Bundled PostgreSQL is incomplete.",
    `Expected location: ${result.resourcesRoot}`,
    "",
  ];
  if (result.missing.length > 0) {
    lines.push("Missing executables:", ...result.missing.map((m) => `  - bin/${m}`));
  }
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((w) => `  - ${w}`));
  }
  lines.push("", "See docs/DESKTOP_POSTGRESQL.md for setup instructions.");
  return lines.join("\n");
}
