/**
 * Keep the latest resume document per candidate and delete extra copies + orphan upload files.
 * Usage: npx tsx scripts/cleanup-duplicate-resumes.ts [--keep=latest]
 */
import { readdir, unlink } from "fs/promises";
import { join, resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function resolveDirectDatabaseUrl(): string {
  if (process.env.DIRECT_URL?.trim()) return process.env.DIRECT_URL.trim();

  const pooler = process.env.DATABASE_URL ?? "";
  if (!pooler) throw new Error("DATABASE_URL is not set");

  const refMatch = pooler.match(/postgres(?:ql)?:\/\/postgres\.([^:@/]+)/i);
  if (refMatch) {
    const ref = refMatch[1];
    const direct = new URL(pooler);
    direct.username = "postgres";
    direct.password = decodeURIComponent(direct.password);
    direct.hostname = `db.${ref}.supabase.co`;
    direct.port = "5432";
    direct.searchParams.delete("pgbouncer");
    direct.searchParams.delete("connection_limit");
    direct.searchParams.delete("pool_timeout");
    if (!direct.searchParams.has("sslmode")) {
      direct.searchParams.set("sslmode", "require");
    }
    return direct.toString();
  }

  return pooler.replace(":6543/", ":5432/").replace(/([?&])pgbouncer=true&?/g, "$1");
}

process.env.DATABASE_URL = resolveDirectDatabaseUrl();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { getUploadsDir } = await import("../src/lib/runtime/paths");
  const prisma = new PrismaClient();

  try {
    const extras = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT d.id
      FROM "Document" d
      WHERE d.type = 'RESUME'
        AND d."candidateId" IS NOT NULL
        AND d.id NOT IN (
          SELECT DISTINCT ON ("candidateId") id
          FROM "Document"
          WHERE type = 'RESUME' AND "candidateId" IS NOT NULL
          ORDER BY "candidateId", "isLatest" DESC, "createdAt" DESC
        )
    `;

    console.log(`Extra resume documents to remove: ${extras.length}`);

    const batchSize = 200;
    let deletedDocs = 0;
    for (let i = 0; i < extras.length; i += batchSize) {
      const ids = extras.slice(i, i + batchSize).map((row) => row.id);
      const result = await prisma.document.deleteMany({ where: { id: { in: ids } } });
      deletedDocs += result.count;
      if ((i / batchSize) % 10 === 0) {
        console.log(`  deleted documents ${deletedDocs}/${extras.length}`);
      }
    }

    await prisma.$executeRaw`
      UPDATE "Document"
      SET "isLatest" = true
      WHERE type = 'RESUME'
        AND "candidateId" IS NOT NULL
        AND id IN (
          SELECT DISTINCT ON ("candidateId") id
          FROM "Document"
          WHERE type = 'RESUME' AND "candidateId" IS NOT NULL
          ORDER BY "candidateId", "createdAt" DESC
        )
    `;

    const keepRows = await prisma.document.findMany({
      where: { storageKey: { not: "" } },
      select: { storageKey: true },
    });
    const pendingDrafts = await prisma.candidateDraft.findMany({
      where: { status: "PENDING", storageKey: { not: null } },
      select: { storageKey: true },
    });
    const keep = new Set(
      [...keepRows, ...pendingDrafts]
        .map((row) => row.storageKey)
        .filter((key): key is string => Boolean(key)),
    );

    const uploadsDir = process.env.STORAGE_LOCAL_PATH?.trim()
      ? resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH.trim())
      : getUploadsDir();
    const files = await readdir(uploadsDir);
    let deletedFiles = 0;
    let keptFiles = 0;
    for (const file of files) {
      if (keep.has(file)) {
        keptFiles += 1;
        continue;
      }
      try {
        await unlink(join(uploadsDir, file));
        deletedFiles += 1;
      } catch {
        // file may already be gone
      }
      if (deletedFiles > 0 && deletedFiles % 2000 === 0) {
        console.log(`  deleted files ${deletedFiles}`);
      }
    }

    console.log(
      JSON.stringify(
        {
          extraDocumentsFound: extras.length,
          documentsDeleted: deletedDocs,
          filesKept: keptFiles,
          filesDeleted: deletedFiles,
          keepKeys: keep.size,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
