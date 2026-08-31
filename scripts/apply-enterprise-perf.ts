import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function splitSql(sql: string) {
  const statements: string[] = [];
  let current = "";
  let inDollar = false;
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !inDollar) continue;
    if (trimmed.includes("$$")) inDollar = !inDollar;
    current += `${line}\n`;
    if (!inDollar && trimmed.endsWith(";")) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const sqlPath = resolve(process.cwd(), "prisma/migrations/20260831_enterprise_perf/migration.sql");
  const statements = splitSql(readFileSync(sqlPath, "utf8"));
  console.log(`Applying ${statements.length} SQL statements...`);
  for (const statement of statements) {
    const preview = statement.replace(/\s+/g, " ").slice(0, 90);
    try {
      await prisma.$executeRawUnsafe(statement);
      console.log(`OK  ${preview}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists|duplicate/i.test(message)) {
        console.log(`SKIP  ${preview}`);
        continue;
      }
      throw error;
    }
  }
  await prisma.$disconnect();
  console.log("Enterprise performance SQL applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
