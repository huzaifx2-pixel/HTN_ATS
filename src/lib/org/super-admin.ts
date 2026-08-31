const DEFAULT_SUPER_ADMIN_EMAIL = "huzaif@headsbaseconsulting.com";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Email allowed to add/remove users and change roles (defaults to Huzaif). */
export function getSuperAdminEmail() {
  return normalizeEmail(process.env.HEADSBASE_SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL);
}

export function isSuperAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return normalizeEmail(email) === getSuperAdminEmail();
}
