/**
 * Point BETTER_AUTH_URL at this machine's LAN address so other devices can sign in.
 *
 * Usage:
 *   npm run env:use-lan-url
 *   npm run env:use-lan-url -- 192.168.1.50
 *   npm run env:use-lan-url -- 192.168.1.50 3000
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectLanIp } from "./detect-lan-ip";

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example to .env first.");
  process.exit(1);
}

const port = process.argv[3]?.trim() || process.env.PORT?.trim() || "3000";
const ipArg = process.argv[2]?.trim();
const ip = ipArg || detectLanIp();

if (!ip) {
  console.error(
    "Could not detect LAN IP. Pass it explicitly:\n  npm run env:use-lan-url -- 192.168.1.50"
  );
  process.exit(1);
}

const baseUrl = `http://${ip}:${port}`;

let env = readFileSync(envPath, "utf8");

function setOrReplace(key: string, value: string) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, `${key}="${value}"`);
  } else {
    env = `${key}="${value}"\n${env}`;
  }
}

setOrReplace("BETTER_AUTH_URL", baseUrl);
setOrReplace("NEXT_PUBLIC_APP_URL", baseUrl);
setOrReplace("GOOGLE_OAUTH_REDIRECT_URI", `${`http://127.0.0.1:${port}`}/api/gmail/callback`);
setOrReplace("PORT", port);
setOrReplace("HOSTNAME", "0.0.0.0");

writeFileSync(envPath, env, "utf8");

console.log("Updated .env for LAN access:");
console.log(`  BETTER_AUTH_URL=${baseUrl}`);
console.log(`  NEXT_PUBLIC_APP_URL=${baseUrl}`);
console.log(`  GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:${port}/api/gmail/callback`);
console.log(`  HOSTNAME=0.0.0.0`);
console.log(`  PORT=${port}`);
console.log(`\nOther devices on your network can open: ${baseUrl}`);
console.log(`\nGmail OAuth: use http://127.0.0.1:${port}/api/gmail/connect on this PC (Google blocks LAN IPs).`);
