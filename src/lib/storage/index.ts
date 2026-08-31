import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { StorageAdapter } from "@/lib/storage/types";
import { R2StorageAdapter } from "@/lib/storage/r2-storage";
import { getUploadsDir } from "@/lib/runtime/paths";

export type { StorageAdapter } from "@/lib/storage/types";

function resolveStoragePath(basePath: string, storageKey: string): string {
  if (!storageKey || storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
    throw new Error("Invalid storage key");
  }
  const resolvedBase = path.resolve(basePath);
  const fullPath = path.resolve(resolvedBase, storageKey);
  if (!fullPath.startsWith(resolvedBase + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return fullPath;
}

class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private async ensureDir() {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async upload(file: Buffer, fileName: string, _mimeType?: string): Promise<string> {
    await this.ensureDir();
    const ext = path.extname(fileName);
    const key = `${randomUUID()}${ext}`;
    const fullPath = resolveStoragePath(this.basePath, key);
    await fs.writeFile(fullPath, file);
    return key;
  }

  async getUrl(storageKey: string): Promise<string> {
    return `/api/files/${encodeURIComponent(storageKey)}`;
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.unlink(resolveStoragePath(this.basePath, storageKey));
    } catch {
      // file may not exist
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(resolveStoragePath(this.basePath, storageKey));
  }
}

let localStorageInstance: StorageAdapter | null = null;
let r2StorageInstance: StorageAdapter | null = null;
let activeStorageInstance: StorageAdapter | null = null;

export function getR2BucketName() {
  return process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim() || "";
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      getR2BucketName()
  );
}

export function getStorageProviderName(): "local" | "r2" {
  const requested = process.env.STORAGE_PROVIDER?.trim().toLowerCase() ?? "local";
  if (requested === "r2" && isR2Configured()) return "r2";
  return "local";
}

export function getActiveStorageProvider() {
  return getStorageProviderName();
}

function getLocalStorage() {
  if (!localStorageInstance) {
    localStorageInstance = new LocalStorageAdapter(
      process.env.STORAGE_LOCAL_PATH ?? getUploadsDir()
    );
  }
  return localStorageInstance;
}

function getR2Storage() {
  if (!r2StorageInstance) {
    r2StorageInstance = new R2StorageAdapter();
  }
  return r2StorageInstance;
}

/** Default adapter for new uploads (respects STORAGE_PROVIDER). */
export function getStorage(): StorageAdapter {
  if (!activeStorageInstance) {
    activeStorageInstance =
      getStorageProviderName() === "r2" ? getR2Storage() : getLocalStorage();
  }
  return activeStorageInstance;
}

/** Resolve adapter for an existing document by its stored provider tag. */
export function getStorageForProvider(provider?: string | null): StorageAdapter {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === "r2" && isR2Configured()) return getR2Storage();
  return getLocalStorage();
}

export function resetStorageInstances() {
  localStorageInstance = null;
  r2StorageInstance = null;
  activeStorageInstance = null;
}

export function getStorageStatus() {
  const requested = process.env.STORAGE_PROVIDER?.trim().toLowerCase() ?? "local";
  const active = getStorageProviderName();
  return {
    requested,
    active,
    r2Configured: isR2Configured(),
    bucket: getR2BucketName() || null,
    endpoint:
      process.env.R2_ENDPOINT?.trim() ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
        : null),
  };
}
