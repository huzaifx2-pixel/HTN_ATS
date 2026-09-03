import { normalizeEmail } from "@/lib/org/signup-domain";

const DEFAULT_SUPER_ADMIN_EMAIL = "jobs@headsbaseconsulting.com";

/** Email allowed to add/remove users and change roles (defaults to jobs@). */
export function getSuperAdminEmail() {
  return normalizeEmail(process.env.HEADSBASE_SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL);
}

export function isSuperAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return normalizeEmail(email) === getSuperAdminEmail();
}
