/**
 * Remove stale low-quality job matches after raising the persist threshold.
 * Usage: npx tsx scripts/cleanup-stale-matches.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const THRESHOLD = 60;

async function main() {
  const { prisma } = await import("../src/lib/db");

  const deleted = await prisma.jobMatch.deleteMany({
    where: { score: { lt: THRESHOLD } },
  });

  console.log(`Removed ${deleted.count} job match(es) below score ${THRESHOLD}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
