/**
 * Validates bundled Prisma CLI can load without missing modules.
 * Run after desktop:prepare: npx tsx scripts/validate-prisma-cli.ts
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const prismaCli = path.join(
  root,
  "resources",
  "prisma-cli",
  "node_modules",
  "prisma",
  "build",
  "index.js"
);
const nodeModules = path.join(root, "resources", "prisma-cli", "node_modules");

if (!fs.existsSync(prismaCli)) {
  console.error("Missing prisma CLI — run npm run desktop:prepare first.");
  process.exit(1);
}

try {
  const out = execFileSync(process.execPath, [prismaCli, "--version"], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_PATH: nodeModules,
    },
    cwd: path.dirname(prismaCli),
    stdio: "pipe",
  });
  console.log("Prisma CLI validation: PASS");
  console.log(out.toString().trim());
} catch (error) {
  const detail =
    error instanceof Error && "stderr" in error
      ? String((error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr ?? error.message)
      : error instanceof Error
        ? error.message
        : String(error);
  console.error("Prisma CLI validation: FAIL\n", detail);
  process.exit(1);
}
