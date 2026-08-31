"use server";

import { revalidatePath } from "next/cache";
import * as memberService from "@/lib/services/member-service";

function formError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export async function updateProfileNameAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    const name = String(formData.get("name") ?? "");
    await memberService.updateOwnName(name);
    revalidatePath("/settings/profile", "page");
    revalidatePath("/", "layout");
    return undefined;
  } catch (error) {
    return formError(error);
  }
}
