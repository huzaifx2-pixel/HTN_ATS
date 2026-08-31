import { prisma } from "@/lib/db";
import { getActiveStorageProvider, getStorage } from "@/lib/storage";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/constants/storage";
import type { DocumentType } from "@prisma/client";

export async function trackStorageUsage(organizationId: string, deltaBytes: number) {
  if (!deltaBytes) return;

  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      storageUsedBytes: BigInt(Math.max(0, deltaBytes)),
      storageLimitBytes: BigInt(DEFAULT_STORAGE_LIMIT_BYTES),
    },
    update: {
      storageUsedBytes: { increment: BigInt(deltaBytes) },
    },
  });
}

export async function uploadOrganizationFile(
  organizationId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  type: DocumentType
) {
  const storage = getStorage();
  const provider = getActiveStorageProvider();
  const storageKey = await storage.upload(file, fileName, mimeType);

  await trackStorageUsage(organizationId, file.length);

  return {
    storageKey,
    storageProvider: provider,
    sizeBytes: file.length,
    type,
  };
}

export async function deleteOrganizationFile(
  organizationId: string,
  storageKey: string,
  storageProvider: string | null | undefined,
  sizeBytes: number
) {
  const { getStorageForProvider } = await import("@/lib/storage");
  const storage = getStorageForProvider(storageProvider);
  await storage.delete(storageKey);
  await trackStorageUsage(organizationId, -sizeBytes);
}
