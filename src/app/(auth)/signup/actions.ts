"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { sessionRequestHeaders } from "@/lib/auth/request-headers";
import { scheduleOrgJobsSynced } from "@/lib/server/ensure-org-jobs-synced";
import { ensureUserInCanonicalOrg } from "@/lib/org/ensure-canonical-org";

export async function signupAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return "All fields are required.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  try {
    const signup = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await sessionRequestHeaders(),
    });

    const org = await ensureUserInCanonicalOrg(signup.user.id, "RECRUITER");

    try {
      await auth.api.setActiveOrganization({
        body: { organizationId: org.id },
        headers: await sessionRequestHeaders(signup.token),
      });
    } catch (error) {
      console.warn(
        "[signup] setActiveOrganization skipped:",
        error instanceof Error ? error.message : error,
      );
    }

    scheduleOrgJobsSynced(org.id);
  } catch (error) {
    if (error instanceof APIError) {
      return error.message ?? "Signup failed";
    }
    return "Signup failed. Please try again.";
  }

  redirect("/dashboard");
}
