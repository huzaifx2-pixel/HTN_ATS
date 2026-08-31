/**
 * Enable pgvector on DIRECT_URL and apply RAG tables/indexes.
 * Pooled DATABASE_URL (pgbouncer) cannot run CREATE EXTENSION — use DIRECT_URL.
 * Usage: npm run db:enable-pgvector
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function splitSqlStatements(sql: string) {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function main() {
  const { resolveDatabaseUrl } = await import("../src/lib/db/resolve-database-url");
  const url = process.env.DIRECT_URL?.trim() || resolveDatabaseUrl();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `pgvector is not installed on this Postgres.\n${detail}\n\nLocal Docker: docker compose uses image pgvector/pgvector:pg16 (npm run db:up), then point DATABASE_URL/DIRECT_URL at that instance.\nWindows Postgres: install the pgvector extension for your major version, or use Docker.\nHosted: run this script against DIRECT_URL (Supabase/Neon support CREATE EXTENSION vector).`
      );
    }

    const ext = await prisma.$queryRaw<Array<{ extname: string; extversion: string }>>`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
    `;
    if (!ext[0]) {
      throw new Error(
        "pgvector extension is not available. Local Docker must use image pgvector/pgvector:pg16. Hosted Postgres (Supabase/Neon) must allow CREATE EXTENSION vector on DIRECT_URL."
      );
    }
    console.log(`pgvector OK — vector ${ext[0].extversion} on ${url.replace(/:[^:@]+@/, ":***@")}`);

    const migrationPath = resolve(process.cwd(), "prisma/sql/rag_pgvector.sql");
    const statements = splitSqlStatements(readFileSync(migrationPath, "utf8")).filter(
      (statement) => !/^CREATE EXTENSION/i.test(statement)
    );
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('EmbeddingChunk', 'KnowledgeDocument')
      ORDER BY table_name
    `;
    console.log(`RAG tables: ${tables.map((row) => row.table_name).join(", ") || "(none)"}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
