/**
 * Start the production server from Next.js standalone output.
 * With output: "standalone", use this instead of `next start`.
 *
 * Usage:
 *   npm run start
 *   npm run start:lan
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { applyMaxListeners } from "../src/lib/runtime/apply-max-listeners";
import { prepareStandaloneAssets } from "./prepare-standalone";

applyMaxListeners();

const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env") });

prepareStandaloneAssets({ phase: "startup" });

const standaloneDir = path.join(root, ".next", "standalone");
const serverEntry = path.join(standaloneDir, "server.js");

const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
const port = process.env.PORT?.trim() || "3000";

console.log(`Starting standalone server on http://${hostname}:${port}\n`);

const result = spawnSync(process.execPath, [serverEntry], {
  cwd: standaloneDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: hostname,
    PORT: port,
    HEADSBASE_APP_ROOT: root,
  },
});

process.exit(result.status ?? 1);
