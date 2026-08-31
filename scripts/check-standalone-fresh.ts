/**
 * Exit 0 when standalone build is up to date, 1 when missing or stale.
 * Used by start-headsbase.bat to avoid serving old production bundles.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone", "server.js");

if (!fs.existsSync(standalone)) {
  process.exit(1);
}

const standaloneMtime = fs.statSync(standalone).mtimeMs;

function newestMtime(dir: string): number {
  let max = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      max = Math.max(max, newestMtime(fullPath));
      continue;
    }
    if (/\.(tsx?|jsx?|css|prisma)$/.test(entry.name)) {
      max = Math.max(max, fs.statSync(fullPath).mtimeMs);
    }
  }
  return max;
}

let sourceNewest = newestMtime(path.join(root, "src"));
const schemaPath = path.join(root, "prisma", "schema.prisma");
if (fs.existsSync(schemaPath)) {
  sourceNewest = Math.max(sourceNewest, fs.statSync(schemaPath).mtimeMs);
}

process.exit(sourceNewest > standaloneMtime ? 1 : 0);
