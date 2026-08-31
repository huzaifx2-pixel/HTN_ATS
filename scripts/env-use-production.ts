import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateAuthSecret, isWeakAuthSecret } from "./lib/secrets";

/**
 * Configure durable production paths and a strong auth secret.
 * Usage: npm run env:use-production
 */
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(".env not found. Copy .env.example to .env first.");
  process.exit(1);
}

const dataRoot = resolve(process.cwd(), "data");
const uploadsDir = resolve(dataRoot, "uploads");
const backupsDir = resolve(dataRoot, "backups");

for (const dir of [dataRoot, uploadsDir, backupsDir]) {
  mkdirSync(dir, { recursive: true });
}

let env = readFileSync(envPath, "utf8");

function getEnvValue(key: string): string | undefined {
  const match = env.match(new RegExp(`^${key}="?([^"\\n]+)"?`, "m"));
  return match?.[1];
}

function setOrReplace(key: string, value: string) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, `${key}="${value}"`);
  } else {
    env = `${key}="${value}"\n${env}`;
  }
}

const currentSecret = getEnvValue("BETTER_AUTH_SECRET");
if (isWeakAuthSecret(currentSecret)) {
  setOrReplace("BETTER_AUTH_SECRET", generateAuthSecret());
  console.log("Generated a new BETTER_AUTH_SECRET (previous value was missing or weak).");
} else {
  console.log("Kept existing BETTER_AUTH_SECRET.");
}

setOrReplace("HEADSBASE_DATA_DIR", "./data");
setOrReplace("STORAGE_PROVIDER", "local");
setOrReplace("STORAGE_LOCAL_PATH", "./data/uploads");
setOrReplace("NODE_ENV", "production");

writeFileSync(envPath, env, "utf8");

console.log("\nProduction data paths configured:");
console.log(`  HEADSBASE_DATA_DIR=./data`);
console.log(`  STORAGE_LOCAL_PATH=./data/uploads`);
console.log(`  Backups directory: ./data/backups`);
console.log("\nYour database is on the local PostgreSQL server — back it up with npm run backup.");
