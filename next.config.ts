import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMaxListeners } from "./src/lib/runtime/apply-max-listeners";

applyMaxListeners();

function detectPrivateIpv4s(): string[] {
  const ips: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      const family = addr.family as string | number;
      if (family !== "IPv4" && family !== 4) continue;
      if (addr.internal) continue;
      const ip = addr.address;
      if (
        ip.startsWith("192.168.") ||
        ip.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      ) {
        ips.push(ip);
      }
    }
  }
  return ips;
}

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
const lanHosts = [
  ...new Set([
    lan.host,
    ...detectPrivateIpv4s(),
    "localhost",
    "127.0.0.1",
  ]),
];
const actionOrigins = lanHosts.map((host) => `${host}:3000`);

const isNetlify = Boolean(process.env.NETLIFY);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway/desktop use standalone. Netlify's Next runtime cannot use that output mode.
  ...(isNetlify ? {} : { output: "standalone" as const }),
  // Keep file tracing inside the project (avoids Windows absolute-path copy bugs).
  outputFileTracingRoot: projectRoot,
  ...(isNetlify
    ? {
        outputFileTracingIncludes: {
          "*": ["node_modules/@swc/helpers/**"],
        },
      }
    : {
        outputFileTracingExcludes: {
          "*": [
            "**/.git/**",
            "**/node_modules/@swc/**",
            "**/node_modules/webpack/**",
            "**/node_modules/terser/**",
          ],
        },
      }),
  allowedDevOrigins: lanHosts,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@prisma/client", "prisma"],
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    proxyClientMaxBodySize: "15mb",
    serverActions: {
      bodySizeLimit: "15mb",
      allowedOrigins: actionOrigins,
    },
  },
};

export default nextConfig;
