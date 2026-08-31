import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const migrationName = "00000000000000_init";
const migrationPath = join("prisma", "migrations", migrationName, "migration.sql");
const checksum = createHash("sha256").update(readFileSync(migrationPath)).digest("hex");

const prisma = new PrismaClient();
try {
  const updated = await prisma.$executeRaw`
    UPDATE "_prisma_migrations"
    SET checksum = ${checksum}
    WHERE migration_name = ${migrationName}
  `;
  console.log(`Updated checksum for ${migrationName} (${updated} row(s)).`);
} finally {
  await prisma.$disconnect();
}
