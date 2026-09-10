"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/auth/session";
import { FEATURE_ROLES, type EditableFeatureRole } from "@/lib/auth/features";
import { saveOrganizationRoleMatrix } from "@/lib/services/role-feature-service";

export async function saveRoleMatrixAction(grants: Record<EditableFeatureRole, string[]>) {
  try {
    const ctx = await requireSuperadmin();
    const next = {
      ADMIN: grants.ADMIN ?? [],
      RECRUITER: grants.RECRUITER ?? [],
      EXTERNAL_RECRUITER: grants.EXTERNAL_RECRUITER ?? [],
    };
    for (const role of FEATURE_ROLES) {
      if (!Array.isArray(next[role])) {
        return { error: "Invalid permission payload." };
      }
    }
    await saveOrganizationRoleMatrix(ctx.organizationId, next);
    revalidatePath("/admin/roles");
    revalidatePath("/", "layout");
    return { updatedAt: new Date().toISOString() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save permissions." };
  }
}
