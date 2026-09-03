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

// Railway/Docker set HOSTNAME to the container id — never bind to that.
// Prefer LISTEN_HOST / HOST; only honor HOSTNAME when it is an explicit listen address.
function resolveListenHost(): string {
  const explicit = process.env.LISTEN_HOST?.trim() || process.env.HOST?.trim();
  if (explicit) return explicit;
  const hostname = process.env.HOSTNAME?.trim();
  if (
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "127.0.0.1" ||
    hostname === "localhost"
  ) {
    return hostname;
  }
  return "0.0.0.0";
}

const hostname = resolveListenHost();
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
