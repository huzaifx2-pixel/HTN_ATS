/**
 * Prepares Next.js standalone output for Electron packaging.
 * Copies static assets and Prisma schema into locations expected by the desktop shell.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");

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

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run npm run build first.");
  process.exit(1);
}

console.log("Copying .next/static → standalone...");
copyRecursive(staticSrc, staticDest);

console.log("Copying public → standalone...");
copyRecursive(publicSrc, publicDest);

const skillsSrc = path.join(root, "src", "lib", "parsers", "data", "skills.csv");
const skillsDest = path.join(standalone, "src", "lib", "parsers", "data", "skills.csv");
if (fs.existsSync(skillsSrc)) {
  fs.mkdirSync(path.dirname(skillsDest), { recursive: true });
  fs.copyFileSync(skillsSrc, skillsDest);
  console.log("Copied skills.csv → standalone");
}

const pdfWorkerSrc = path.join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
const pdfWorkerDest = path.join(
  standalone,
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.mjs"
);
if (fs.existsSync(pdfWorkerSrc)) {
  fs.mkdirSync(path.dirname(pdfWorkerDest), { recursive: true });
  fs.copyFileSync(pdfWorkerSrc, pdfWorkerDest);
  console.log("Copied pdf.worker.mjs → standalone");
}

const prismaInStandalone = path.join(standalone, "prisma");
copyRecursive(path.join(root, "prisma"), prismaInStandalone);

const resourcesPrisma = path.join(root, "resources", "prisma");
fs.mkdirSync(resourcesPrisma, { recursive: true });
copyRecursive(path.join(root, "prisma"), resourcesPrisma);

const parserResources = path.join(root, "resources", "parser");
fs.mkdirSync(parserResources, { recursive: true });
if (fs.existsSync(pdfWorkerSrc)) {
  fs.copyFileSync(pdfWorkerSrc, path.join(parserResources, "pdf.worker.mjs"));
  console.log("Copied pdf.worker.mjs → resources/parser");
}
if (fs.existsSync(skillsSrc)) {
  fs.copyFileSync(skillsSrc, path.join(parserResources, "skills.csv"));
  console.log("Copied skills.csv → resources/parser");
}

const prismaCliModules = path.join(root, "resources", "prisma-cli", "node_modules");
/** Prisma migrate CLI and transitive runtime deps (hoisted for NODE_PATH resolution). */
const prismaPackages = [
  "prisma",
  "@prisma",
  ".prisma",
  "fast-check",
  "pure-rand",
  "effect",
  "c12",
  "deepmerge-ts",
  "empathic",
  "jiti",
  "pathe",
  "perfect-debounce",
  "defu",
  "ufo",
  "ohash",
  "rc9",
  "pkg-types",
  "confbox",
  "exsolve",
];
for (const pkg of prismaPackages) {
  const src = path.join(root, "node_modules", pkg);
  const dest = path.join(prismaCliModules, pkg);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`Copied ${pkg} → resources/prisma-cli/node_modules`);
  } else {
    console.warn(`Warning: optional Prisma CLI dependency not found: ${pkg}`);
  }
}

console.log("Desktop prepare complete.");
