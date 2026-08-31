import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import {
  getStorage,
  getStorageForProvider,
  isR2Configured,
  resetStorageInstances,
} from "../src/lib/storage";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  if (!isR2Configured()) {
    throw new Error(
      "R2 is not fully configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME."
    );
  }

  process.env.STORAGE_PROVIDER = "r2";
  resetStorageInstances();

  const prisma = new PrismaClient();
  const target = getStorage();
  const local = getStorageForProvider("local");

  const documents = await prisma.document.findMany({
    where: {
      OR: [{ storageProvider: "local" }, { storageProvider: null }],
    },
    select: {
      id: true,
      organizationId: true,
      storageKey: true,
      fileName: true,
      mimeType: true,
      storageProvider: true,
    },
  });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of documents) {
    if (!doc.storageKey || !doc.organizationId) {
      skipped++;
      continue;
    }

    try {
      const file = await local.read(doc.storageKey);
      const newKey = await target.upload(file, doc.fileName, doc.mimeType);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          storageKey: newKey,
          storageProvider: "r2",
          sizeBytes: file.length,
        },
      });

      await local.delete(doc.storageKey);
      migrated++;
      console.log(`Migrated ${doc.fileName} (${doc.id})`);
    } catch (error) {
      failed++;
      console.error(`Failed ${doc.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
