/**
 * Sanitize parsed contact fields so resume prose and glued labels
 * (e.g. "user@gmail.comPhone:") never surface in the UI or DB.
 */

const EMAIL_CAPTURE_REGEX =
  /\b([a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?)@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,63})(?![a-zA-Z0-9])/gi;

const LOCATION_PROSE_REGEX =
  /\b(expertise|experience|years?|building|platform|solution|development|management|strong|proficient|skilled|responsible|deliver|delivered|enterprise|cloud|software|engineer|architect|specialist|consultant|professional|summary|objective|profile)\b/i;

const LOCATION_TECH_REGEX =
  /\b(aws|azure|gcp|kubernetes|docker|python|java|react|angular|node\.?js|sql|spark|hadoop|snowflake|databricks)\b/i;

const CITY_STATE_REGEX = /^([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/;
const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;

const INVALID_EMAIL_DOMAIN_SUFFIXES =
  /(?:phone|mobile|tel|fax|linkedin|github|portfolio|website|address|location)$/i;

export { EMAIL_CAPTURE_REGEX as EMAIL_REGEX };

function validateEmailCandidate(candidate: string): string | null {
  const email = candidate.trim().toLowerCase();
  if (!email.includes("@")) return null;
  if (/\.\./.test(email)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  const [local, domain] = email.split("@");
  if (!local || !domain || domain.startsWith(".") || domain.endsWith(".")) return null;

  const labels = domain.split(".");
  if (labels.some((label) => !label || label.length > 63)) return null;
  if (INVALID_EMAIL_DOMAIN_SUFFIXES.test(labels[labels.length - 1] ?? "")) return null;

  return email;
}

function captureEmailsFromText(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  EMAIL_CAPTURE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EMAIL_CAPTURE_REGEX.exec(text)) !== null) {
    const normalized = validateEmailCandidate(`${match[1]}@${match[2]}`);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      results.push(normalized);
    }
  }

  return results;
}

export function extractAllEmails(text: string): string[] {
  return captureEmailsFromText(text);
}

export function normalizeEmail(raw: string): string | null {
  const trimmed = raw.trim().replace(/^(?:e-?mail|email address)\s*:?\s*/i, "");

  const fromSpaced = captureEmailsFromText(trimmed)[0];
  if (fromSpaced) return fromSpaced;

  const compact = trimmed.replace(/[\s\t\n\r]+/g, "");
  const direct = compact.match(
    /^([a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?)@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,63})(?![a-zA-Z0-9])/i
  );
  if (direct) {
    return validateEmailCandidate(`${direct[1]}@${direct[2]}`);
  }

  return captureEmailsFromText(compact)[0] ?? null;
}

export function sanitizeCandidateEmail(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  return normalizeEmail(raw) ?? undefined;
}

export function isValidLocationString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (trimmed.includes("@")) return false;
  if (LOCATION_PROSE_REGEX.test(trimmed)) return false;
  if (LOCATION_TECH_REGEX.test(trimmed)) return false;
  if (/[;:]/.test(trimmed) && trimmed.length > 30) return false;

  if (/^(remote|hybrid|onsite|on-site|wfh|work from home)$/i.test(trimmed)) return true;
  if (CITY_STATE_REGEX.test(trimmed)) return true;
  if (ZIP_REGEX.test(trimmed) && trimmed.length <= 60) return true;

  const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2 && commaParts.length <= 4 && trimmed.length <= 60) {
    return commaParts.every((part) => part.length <= 40 && !LOCATION_PROSE_REGEX.test(part));
  }

  if (trimmed.length <= 35 && /^[\p{L}\s'.-]+$/u.test(trimmed)) {
    return !LOCATION_PROSE_REGEX.test(trimmed);
  }

  return false;
}

export function sanitizeCandidateLocation(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  if (!isValidLocationString(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeCandidateCity(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length > 40 || LOCATION_PROSE_REGEX.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeParsedContactFields(fields: {
  email?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
}): {
  email?: string;
  location?: string;
  city?: string;
  country?: string;
} {
  return {
    email: sanitizeCandidateEmail(fields.email),
    location: sanitizeCandidateLocation(fields.location),
    city: sanitizeCandidateCity(fields.city),
    country: sanitizeCandidateCity(fields.country) ?? (fields.country?.trim() || undefined),
  };
}
