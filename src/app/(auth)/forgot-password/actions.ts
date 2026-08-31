"use server";

import { redirect } from "next/navigation";
import { setCredentialPasswordByEmail, validateNewPassword } from "@/lib/auth/password";

export async function forgotPasswordAction(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email) {
    return "Email is required.";
  }

  const invalid = validateNewPassword(password, confirmPassword);
  if (invalid) {
    return invalid;
  }

  try {
    await setCredentialPasswordByEmail(email, password);
  } catch (error) {
    if (error instanceof Error) return error.message;
    return "Could not reset password.";
  }

  redirect("/login?reset=1");
}
