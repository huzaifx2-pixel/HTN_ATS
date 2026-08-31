/**
 * Copy assets required by Next.js standalone output (static, public, env).
 * Fixes Turbopack hashed external module names for Prisma/AWS SDK.
 *
 * Usage: tsx scripts/prepare-standalone.ts
 */
import fs from "node:fs";
import path from "node:path";
import { applyMaxListeners } from "../src/lib/runtime/apply-max-listeners";

applyMaxListeners();

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

const EXTERNAL_ALIASES: Record<string, string> = {
  "@prisma/client": "@prisma/client",
  "@aws-sdk/client-s3": "@aws-sdk/client-s3",
};

function copyRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function walkFiles(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, files);
    else if (entry.isFile() && (full.endsWith(".js") || full.endsWith(".json"))) files.push(full);
  }
  return files;
}

/** Turbopack standalone builds reference hashed package names that are not copied into standalone. */
function ensureHashedExternalAliases() {
  const chunksRoot = path.join(standalone, ".next", "server");
  const files = walkFiles(chunksRoot);
  const hashedPackages = new Set<string>();

  const pattern = /e\.x\("(@[^"]+?)-([a-f0-9]{8,16})"/g;
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(pattern)) {
      hashedPackages.add(`${match[1]}-${match[2]}`);
    }
  }

  for (const hashedName of hashedPackages) {
    const baseName = hashedName.replace(/-[a-f0-9]{8,16}$/, "");
    const target = EXTERNAL_ALIASES[baseName];
    if (!target) continue;

    const targetPath = path.join(standalone, "node_modules", ...target.split("/"));
    if (!fs.existsSync(targetPath)) continue;

    const aliasDir = path.join(standalone, "node_modules", ...hashedName.split("/"));
    fs.mkdirSync(aliasDir, { recursive: true });
    fs.writeFileSync(
      path.join(aliasDir, "package.json"),
      JSON.stringify({ name: hashedName, main: "index.js" }, null, 2),
    );
    fs.writeFileSync(
      path.join(aliasDir, "index.js"),
      `module.exports = require(${JSON.stringify(target)});\n`,
    );
  }
}

/** Remove invalid drive-letter folders created by a Next.js Windows standalone bug. */
function cleanupInvalidStandaloneEntries(standaloneDir: string) {
  if (!fs.existsSync(standaloneDir)) return;

  const removeDriveRoot = (dir: string) => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      if (/^[A-Za-z]:$/.test(name.name)) {
        const bad = path.join(dir, name.name);
        fs.rmSync(bad, { recursive: true, force: true });
        console.log(`Removed invalid standalone folder: ${bad}`);
        continue;
      }
      removeDriveRoot(path.join(dir, name.name));
    }
  };

  removeDriveRoot(standaloneDir);
}

export type PrepareStandaloneOptions = {
  /** postbuild copies all server chunks once; startup only repairs gaps silently */
  phase?: "postbuild" | "startup";
};

export function prepareStandaloneAssets(options: PrepareStandaloneOptions = {}) {
  const phase =
    options.phase ??
    (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/prepare-standalone.ts")
      ? "postbuild"
      : "startup");

  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    console.error("Missing .next/standalone/server.js — run npm run build first.");
    process.exit(1);
  }

  cleanupInvalidStandaloneEntries(standalone);

  copyRecursive(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
  copyRecursive(path.join(root, "public"), path.join(standalone, "public"));

  const envSrc = path.join(root, ".env");
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, path.join(standalone, ".env"));
  }

  copyParserAssets(root, standalone);
  ensureServerChunks(root, standalone, phase);
  ensureHashedExternalAliases();
}

/**
 * Next.js standalone file tracing can omit webpack server chunks that are only
 * loaded at runtime (e.g. date-fns in 8568.js). Without them, pages 500 after login.
 */
function ensureServerChunks(
  rootDir: string,
  standaloneDir: string,
  phase: "postbuild" | "startup",
) {
  const srcChunks = path.join(rootDir, ".next", "server", "chunks");
  const destChunks = path.join(standaloneDir, ".next", "server", "chunks");
  if (!fs.existsSync(srcChunks)) return;

  fs.mkdirSync(destChunks, { recursive: true });

  let repaired = 0;
  for (const entry of fs.readdirSync(srcChunks)) {
    if (!entry.endsWith(".js")) continue;
    const src = path.join(srcChunks, entry);
    const dest = path.join(destChunks, entry);

    if (phase === "startup") {
      if (fs.existsSync(dest)) continue;
      fs.copyFileSync(src, dest);
      repaired++;
      continue;
    }

    fs.copyFileSync(src, dest);
  }

  if (phase === "postbuild") {
    const total = fs.readdirSync(destChunks).filter((name) => name.endsWith(".js")).length;
    console.log(`Standalone server bundles ready (${total} chunks).`);
  } else if (repaired > 0 && process.env.HEADSBASE_VERBOSE === "1") {
    console.log(`Repaired ${repaired} missing server chunk(s).`);
  }
}

/** Parser runtime files are read from disk at request time — not bundled by webpack. */
function copyParserAssets(rootDir: string, standaloneDir: string) {
  const skillsSrc = path.join(rootDir, "src", "lib", "parsers", "data", "skills.csv");
  const skillsDest = path.join(standaloneDir, "src", "lib", "parsers", "data", "skills.csv");
  if (fs.existsSync(skillsSrc)) {
    fs.mkdirSync(path.dirname(skillsDest), { recursive: true });
    fs.copyFileSync(skillsSrc, skillsDest);
    console.log("Copied skills.csv → standalone");
  } else {
    console.warn("Missing skills.csv at", skillsSrc);
  }

  const resourcesParser = path.join(standaloneDir, "resources", "parser");
  fs.mkdirSync(resourcesParser, { recursive: true });
  if (fs.existsSync(skillsSrc)) {
    fs.copyFileSync(skillsSrc, path.join(resourcesParser, "skills.csv"));
    console.log("Copied skills.csv → standalone/resources/parser");
  }

  const pdfWorkerSrc = path.join(rootDir, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  const pdfWorkerDest = path.join(
    standaloneDir,
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );
  if (fs.existsSync(pdfWorkerSrc)) {
    fs.mkdirSync(path.dirname(pdfWorkerDest), { recursive: true });
    fs.copyFileSync(pdfWorkerSrc, pdfWorkerDest);
    fs.copyFileSync(pdfWorkerSrc, path.join(resourcesParser, "pdf.worker.mjs"));
    console.log("Copied pdf.worker.mjs → standalone");
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/prepare-standalone.ts")) {
  prepareStandaloneAssets({ phase: "postbuild" });
  console.log("Standalone assets prepared.");
}
