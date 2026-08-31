"use server";

import { revalidatePath } from "next/cache";
import * as orgSettingsService from "@/lib/services/org-settings-service";

function formError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export async function updateStorageLimitAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    const limitGb = String(formData.get("limitGb") ?? "");
    await orgSettingsService.updateOrgStorageLimit(limitGb);
    revalidatePath("/settings", "page");
    revalidatePath("/", "layout");
    return undefined;
  } catch (error) {
    return formError(error);
  }
}

export async function recalculateStorageUsageAction(): Promise<string | undefined> {
  try {
    await orgSettingsService.recalculateOrgStorageUsage();
    revalidatePath("/settings", "page");
    revalidatePath("/", "layout");
    return undefined;
  } catch (error) {
    return formError(error);
  }
}
