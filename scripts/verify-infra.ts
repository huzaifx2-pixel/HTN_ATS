import { resolve } from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/db/resolve-database-url";
import {
  getStorage,
  getStorageStatus,
  isR2Configured,
  resetStorageInstances,
} from "../src/lib/storage";

config({ path: resolve(process.cwd(), ".env") });

async function verifyDatabase() {
  const url = resolveDatabaseUrl();
  if (!url.startsWith("postgres")) {
    console.log("Database: skipped (DATABASE_URL is not PostgreSQL)");
    return;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const [tables, rls] = await Promise.all([
      prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
      `,
      prisma.$queryRaw<Array<{ disabled: bigint }>>`
        SELECT COUNT(*)::bigint AS disabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      `,
    ]);
    const rlsDisabled = Number(rls[0]?.disabled ?? 0);
    console.log(`Database OK — ${tables.length} public tables, RLS disabled on ${rlsDisabled}`);
    if (rlsDisabled > 0) {
      console.warn("WARN: Run RLS migration or npm run test:smoke after applying prisma/migrations/20260807_enable_rls");
    }

    try {
      const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;
      if (ext[0]) {
        console.log("pgvector OK — vector extension enabled");
      } else {
        console.warn("WARN: pgvector not enabled. Use image pgvector/pgvector:pg16 and npm run db:enable-pgvector on DIRECT_URL.");
      }
    } catch (error) {
      console.warn("WARN: could not check pgvector:", error instanceof Error ? error.message : error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyR2() {
  const status = getStorageStatus();
  console.log("Storage config:", status);

  if (!isR2Configured()) {
    throw new Error(
      "R2 not configured. Add R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY to .env (from Cloudflare R2 API token)."
    );
  }

  process.env.STORAGE_PROVIDER = "r2";
  resetStorageInstances();

  const storage = getStorage();
  const key = await storage.upload(
    Buffer.from("headsbase-ats r2 ok"),
    "probe.txt",
    "text/plain"
  );
  const body = await storage.read(key);
  await storage.delete(key);

  if (body.toString() !== "headsbase-ats r2 ok") {
    throw new Error("R2 read-back mismatch");
  }

  console.log(`R2 OK — bucket "${status.bucket}" read/write/delete succeeded`);
}

async function main() {
  await verifyDatabase();
  await verifyR2();
  console.log("All infrastructure checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
