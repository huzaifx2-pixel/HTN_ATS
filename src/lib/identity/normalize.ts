const LINKEDIN_HOST = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i;

export function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase() ?? "";
  if (!value || !value.includes("@") || value.includes(" ")) return null;
  return value;
}

export function normalizePhone(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 15 ? digits.slice(-15) : digits;
}

export function normalizeLinkedIn(url?: string | null): string | null {
  if (!url?.trim()) return null;
  let value = url.trim().toLowerCase().replace(/\/+$/, "");
  value = value.replace(LINKEDIN_HOST, "");
  value = value.replace(/^(https?:\/\/)?(www\.)?/, "");
  const slug = value.split("/").filter(Boolean).pop() ?? "";
  return slug || null;
}

export function identityFields(input: {
  email?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  resumeFingerprint?: string | null;
}) {
  return {
    normalizedEmail: normalizeEmail(input.email),
    normalizedPhone: normalizePhone(input.phone),
    normalizedLinkedIn: normalizeLinkedIn(input.linkedIn),
    resumeFingerprint: input.resumeFingerprint?.trim() || null,
  };
}
