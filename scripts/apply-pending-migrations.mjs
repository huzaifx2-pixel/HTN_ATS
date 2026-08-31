import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const migrations = [
  "20260831_candidate_dnc/migration.sql",
  "20260831_platform_expansion/migration.sql",
];

function splitStatements(sql) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("--"));
}

try {
  for (const migration of migrations) {
    const sql = readFileSync(join("prisma", "migrations", migration), "utf8");
    console.log(`Applying ${migration}...`);
    for (const statement of splitStatements(sql)) {
      try {
        await prisma.$executeRawUnsafe(`${statement};`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("already exists") ||
          message.includes("duplicate key") ||
          message.includes("IF NOT EXISTS")
        ) {
          console.log(`Skipped (already applied): ${statement.slice(0, 80)}...`);
          continue;
        }
        throw error;
      }
    }
    console.log(`OK: ${migration}`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
