import { resolve } from "path";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { prisma } from "../src/lib/db";

config({ path: resolve(process.cwd(), ".env") });

async function remaining() {
  const emailGroups = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*)::int AS count FROM (
      SELECT 1 FROM "Candidate"
      WHERE email IS NOT NULL AND "deletedAt" IS NULL
      GROUP BY "organizationId", lower(email)
      HAVING COUNT(*) > 1
    ) t
  `;
  const normalizedGroups = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*)::int AS count FROM (
      SELECT 1 FROM "Candidate"
      WHERE "normalizedEmail" IS NOT NULL AND "deletedAt" IS NULL
      GROUP BY "organizationId", "normalizedEmail"
      HAVING COUNT(*) > 1
    ) t
  `;
  return {
    emailGroups: Number(emailGroups[0]?.count ?? 0),
    normalizedEmailGroups: Number(normalizedGroups[0]?.count ?? 0),
  };
}

async function main() {
  const before = await remaining();
  console.log("remaining", before);
  if (before.emailGroups > 0 || before.normalizedEmailGroups > 0) {
    throw new Error("Duplicate emails still exist; unique index not applied.");
  }

  const sql = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260831_enterprise_perf/unique-email-after-merge.sql"),
    "utf8",
  ).replace(/--.*$/gm, "").trim();
  await prisma.$executeRawUnsafe(sql);
  console.log("unique index applied");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
