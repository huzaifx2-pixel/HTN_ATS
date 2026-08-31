import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { resolveDatabaseUrl } = await import("../src/lib/db/resolve-database-url");
  const { backfillOrganization } = await import("../src/lib/rag/indexer");

  const orgId = process.env.RAG_EVAL_ORG_ID?.trim();
  const prisma = new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
  });
  try {
    const org = orgId
      ? await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } })
      : await prisma.organization.findFirst({ select: { id: true } });
    if (!org) throw new Error("No organization found to backfill");
    const result = await backfillOrganization(org.id, Number(process.env.RAG_BACKFILL_LIMIT ?? 80));
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
