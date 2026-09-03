"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { sessionRequestHeaders } from "@/lib/auth/request-headers";
import { ensureUserInCanonicalOrg } from "@/lib/org/ensure-canonical-org";
import { isSingleOrgMode } from "@/lib/org/single-org";

function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

export async function loginAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return "Email and password are required.";
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: await sessionRequestHeaders(),
    });

    if (isSingleOrgMode() && result.user?.id) {
      const org = await ensureUserInCanonicalOrg(result.user.id);
      try {
        await auth.api.setActiveOrganization({
          body: { organizationId: org.id },
          headers: await sessionRequestHeaders(result.token),
        });
      } catch (error) {
        console.warn(
          "[login] setActiveOrganization skipped:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    if (error instanceof APIError) {
      return error.message ?? "Login failed";
    }
    console.error("[login] unexpected error:", error);
    const message = error instanceof Error ? error.message : "Login failed";
    if (/DATABASE_URL|datasource|Prisma|ECONNREFUSED|timeout|empty/i.test(message)) {
      return "Database is unavailable. Check DATABASE_URL / Supabase project status.";
    }
    return message || "Login failed";
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
