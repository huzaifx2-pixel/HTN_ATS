"use server";

import { revalidatePath } from "next/cache";
import { revalidateOrgPaths } from "@/lib/realtime/sync";
import * as memberService from "@/lib/services/member-service";
import type { MemberRole } from "@prisma/client";

function formError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export async function addUserAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await memberService.addOrganizationMember({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? "") || undefined,
      role: String(formData.get("role") ?? "RECRUITER").toUpperCase() as MemberRole,
    });
    await revalidateOrgPaths(["/admin/users"]);
    return undefined;
  } catch (error) {
    return formError(error);
  }
}

export async function removeUserAction(memberId: string): Promise<string | undefined> {
  try {
    await memberService.removeOrganizationMember(memberId);
    await revalidateOrgPaths(["/admin/users"]);
    return undefined;
  } catch (error) {
    return formError(error);
  }
}

export async function updateUserRoleAction(memberId: string, role: string): Promise<string | undefined> {
  try {
    await memberService.updateOrganizationMemberRole(memberId, role);
    await revalidateOrgPaths(["/admin/users"]);
    return undefined;
  } catch (error) {
    return formError(error);
  }
}

export async function updateUserNameAction(memberId: string, name: string): Promise<string | undefined> {
  try {
    await memberService.updateOrganizationMemberName(memberId, name);
    await revalidateOrgPaths(["/admin/users"]);
    revalidatePath("/", "layout");
    return undefined;
  } catch (error) {
    return formError(error);
  }
}

export async function resetUserPasswordAction(
  memberId: string,
  password: string,
  confirmPassword: string,
): Promise<string | undefined> {
  try {
    await memberService.resetOrganizationMemberPassword(memberId, password, confirmPassword);
    return undefined;
  } catch (error) {
    return formError(error);
  }
}
