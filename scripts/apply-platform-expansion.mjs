import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function run(statement) {
  try {
    await prisma.$executeRawUnsafe(statement);
    console.log("OK:", statement.split("\n")[0].slice(0, 100));
  } catch (error) {
    const message =
      error && typeof error === "object" && "meta" in error && error.meta &&
      typeof error.meta === "object" && "message" in error.meta
        ? String(error.meta.message)
        : error instanceof Error
          ? error.message
          : String(error);
    if (
      message.includes("already exists") ||
      message.includes("duplicate") ||
      message.includes("would create a duplicate")
    ) {
      console.log("SKIP:", statement.split("\n")[0].slice(0, 100));
      return;
    }
    throw error;
  }
}

function parseStatements(sql) {
  const statements = [];
  let current = "";
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;
    current += `${line}\n`;
    if (trimmed.endsWith(";")) {
      statements.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

try {
  const sql = readFileSync(
    join("prisma", "migrations", "20260831_platform_expansion", "migration.sql"),
    "utf8",
  );

  for (const statement of parseStatements(sql)) {
    await run(statement);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
