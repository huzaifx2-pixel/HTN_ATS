import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMaxListeners } from "./src/lib/runtime/apply-max-listeners";

applyMaxListeners();

function resolveLanConfig() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  try {
    const parsed = new URL(appUrl);
    return {
      host: parsed.hostname,
      origin: `${parsed.hostname}:${parsed.port || "3000"}`,
    };
  } catch {
    return { host: "localhost", origin: "localhost:3000" };
  }
}

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const lan = resolveLanConfig();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Keep file tracing inside the project (avoids Windows absolute-path copy bugs).
  outputFileTracingRoot: projectRoot,
  outputFileTracingExcludes: {
    "*": [
      "**/.git/**",
      "**/node_modules/@swc/**",
      "**/node_modules/webpack/**",
      "**/node_modules/terser/**",
    ],
  },
  allowedDevOrigins: [
    lan.host,
    "192.168.179.204",
    "192.168.1.4",
    "192.168.1.5",
    "192.168.1.7",
    "192.168.29.202",
    "localhost",
    "127.0.0.1",
  ],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@prisma/client", "prisma"],
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    proxyClientMaxBodySize: "15mb",
    serverActions: {
      bodySizeLimit: "15mb",
      allowedOrigins: [lan.origin, "192.168.179.204:3000", "localhost:3000", "127.0.0.1:3000"],
    },
  },
};

export default nextConfig;
