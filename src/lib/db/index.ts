import { PrismaClient } from "@prisma/client";
import { resolveRuntimeDatabaseUrl } from "./resolve-database-url";
import { getPagePerfLabel, recordSlowQuery } from "@/lib/perf";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function inferRows(result: unknown): number | undefined {
  if (Array.isArray(result)) return result.length;
  return undefined;
}

function createClient() {
  const queryLogging =
    process.env.PERF_LOG === "true" ||
    (process.env.NODE_ENV === "development" && process.env.PERF_LOG !== "false");
  const client = new PrismaClient({
    datasources: { db: { url: resolveRuntimeDatabaseUrl() } },
    log: queryLogging ? ["warn", "error"] : ["error"],
  });

  if (!queryLogging) return client;

  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();
        const result = await query(args);
        const page = getPagePerfLabel();
        const base = model
          ? `${model.toLowerCase()}.${operation}`
          : `raw.${String(operation)}`;
        recordSlowQuery(page ? `${page}.${base}` : base, performance.now() - start, {
          source: "prisma",
          rows: inferRows(result),
        });
        return result;
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
