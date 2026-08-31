import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/constants/storage";
import { withTtlCache, invalidateOrgCache } from "@/lib/cache/ttl-cache";

export { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/constants/storage";

const MIN_STORAGE_LIMIT_GB = 1;
const MAX_STORAGE_LIMIT_GB = 2048;

export async function getOrgStorageSettings(organizationId: string) {
  return withTtlCache(`org-settings:${organizationId}`, 30, async () => {
    const [settings, documentSum] = await Promise.all([
      prisma.orgSettings.findUnique({
        where: { organizationId },
        select: { storageUsedBytes: true, storageLimitBytes: true },
      }),
      prisma.document.aggregate({
        where: {
          OR: [{ organizationId }, { candidate: { organizationId } }],
        },
        _sum: { sizeBytes: true },
        _count: true,
      }),
    ]);

    const storageUsedBytes = Number(settings?.storageUsedBytes ?? 0);
    const storageLimitBytes = Number(settings?.storageLimitBytes ?? DEFAULT_STORAGE_LIMIT_BYTES);
    const actualDocumentBytes = Number(documentSum._sum.sizeBytes ?? 0);

    return {
      storageUsedBytes,
      storageLimitBytes,
      actualDocumentBytes,
      documentCount: documentSum._count,
      usageDriftBytes: storageUsedBytes - actualDocumentBytes,
    };
  });
}

function parseStorageLimitGb(value: string): number {
  const gb = Number.parseFloat(value);
  if (!Number.isFinite(gb) || gb < MIN_STORAGE_LIMIT_GB || gb > MAX_STORAGE_LIMIT_GB) {
    throw new Error(`Storage limit must be between ${MIN_STORAGE_LIMIT_GB} GB and ${MAX_STORAGE_LIMIT_GB} GB.`);
  }
  return Math.round(gb * 1024 * 1024 * 1024);
}

export async function updateOrgStorageLimit(limitGbInput: string) {
  const ctx = await requirePermission("admin");
  const storageLimitBytes = parseStorageLimitGb(limitGbInput);

  await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: {
      organizationId: ctx.organizationId,
      storageLimitBytes: BigInt(storageLimitBytes),
      storageUsedBytes: BigInt(0),
    },
    update: { storageLimitBytes: BigInt(storageLimitBytes) },
  });

  await invalidateOrgCache(ctx.organizationId);
  return { storageLimitBytes };
}

export async function recalculateOrgStorageUsage() {
  const ctx = await requirePermission("admin");

  const documentSum = await prisma.document.aggregate({
    where: {
      OR: [{ organizationId: ctx.organizationId }, { candidate: { organizationId: ctx.organizationId } }],
    },
    _sum: { sizeBytes: true },
  });

  const storageUsedBytes = Number(documentSum._sum.sizeBytes ?? 0);

  await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: {
      organizationId: ctx.organizationId,
      storageUsedBytes: BigInt(storageUsedBytes),
      storageLimitBytes: BigInt(DEFAULT_STORAGE_LIMIT_BYTES),
    },
    update: { storageUsedBytes: BigInt(storageUsedBytes) },
  });

  await invalidateOrgCache(ctx.organizationId);
  return { storageUsedBytes };
}
