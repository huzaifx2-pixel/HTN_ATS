"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { setTelegramNotificationsEnabled } from "@/lib/services/telegram-notification-service";

export async function setTelegramNotificationsEnabledAction(enabled: boolean) {
  const ctx = await requirePermission("admin");
  await setTelegramNotificationsEnabled(enabled, ctx.organizationId);
  revalidatePath("/admin/integrations");
  return { enabled };
}
