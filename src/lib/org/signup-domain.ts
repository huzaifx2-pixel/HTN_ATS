/** Allowed company email domain for self-serve signup. */
export const COMPANY_EMAIL_DOMAIN =
  process.env.HEADSBASE_SIGNUP_DOMAIN?.trim().toLowerCase() || "headsbaseconsulting.com";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string) {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

/** Self-serve signup is limited to the company domain. */
export function isAllowedSignupEmail(email: string | null | undefined) {
  if (!email) return false;
  return getEmailDomain(email) === COMPANY_EMAIL_DOMAIN;
}

export function signupDomainErrorMessage() {
  return `Only @${COMPANY_EMAIL_DOMAIN} email addresses can create an account.`;
}
