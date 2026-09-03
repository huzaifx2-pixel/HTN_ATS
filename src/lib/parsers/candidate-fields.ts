import type { ParsedResumeResult } from "@/lib/parsers/types";
import type { ParsedContactInfo } from "@/lib/parsers/contact-types";
import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";
import { parseProfileMetadata } from "@/lib/parsers/persist-parsed-resume";
import { inferNameFromResumeFileName } from "@/lib/parsers/contact-normalize";
import { normalizePhoneCountryCode, splitPhoneForStorage } from "@/lib/format-phone";
import { sanitizeParsedContactFields } from "@/lib/sanitize-contact";

function formatLocationWithStateZip(parsed: Partial<ParsedResumeResult>): string | undefined {
  const sanitized = sanitizeParsedContactFields({
    location: parsed.location,
    city: parsed.city,
    country: parsed.country,
  });
  if (sanitized.location) return sanitized.location;
  const parts = [sanitized.city, parsed.state, sanitized.country].filter(Boolean);
  if (parts.length > 0) {
    let label = parts.join(", ");
    if (parsed.zipCode) label += ` ${parsed.zipCode}`;
    return label;
  }
  return undefined;
}

export function candidateLocationFields(parsed: Partial<ParsedResumeResult>) {
  return {
    city: parsed.city,
    location: formatLocationWithStateZip(parsed),
    country: parsed.country,
    workAuthorization: parsed.workAuthorization,
    availability: parsed.availability,
  };
}

export function candidatePhoneFields(parsed: Partial<ParsedResumeResult>) {
  return {
    phone: parsed.phone,
    phoneCountryCode: normalizePhoneCountryCode(parsed.phoneCountryCode),
  };
}

export function candidateContactMetadata(contact?: ParsedContactInfo) {
  if (!contact) return undefined;
  const primaryPhone = contact.phones[0];
  const phoneNote = splitPhoneForStorage(primaryPhone);
  return {
    contact,
    phone_country_code: phoneNote.phoneCountryCode,
    search_tokens: contact.search_tokens,
    contact_completeness_score: contact.quality.contact_completeness_score,
    contact_quality_score: contact.quality.contact_quality_score,
    overall_confidence: contact.quality.overall_confidence,
    parser_version: contact.parser.parser_version,
  };
}

export function mergeCandidateMetadata(
  existing: unknown,
  contact?: ParsedContactInfo,
  structured?: StructuredParseResult
): object | undefined {
  const contactMeta = candidateContactMetadata(contact);
  const parseMeta = structured ? parseProfileMetadata(structured) : undefined;
  if (!contactMeta && !parseMeta) return existing as object | undefined;
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...(contactMeta ?? {}), ...(parseMeta ? { parseProfile: parseMeta } : {}) };
}

export function parsedHeadline(parsed: Partial<ParsedResumeResult>): string | undefined {
  if (parsed.summary?.trim()) return parsed.summary.trim().slice(0, 200);
  if (parsed.currentRole && parsed.currentCompany) {
    return `${parsed.currentRole} at ${parsed.currentCompany}`;
  }
  return parsed.currentRole ?? undefined;
}

/** Writes existing Candidate employment columns from parser output. Does not rename production fields. */
export function candidateEmploymentFields(parsed: Partial<ParsedResumeResult>) {
  const years = parsed.experienceYears;
  return {
    currentCompany: parsed.currentCompany,
    currentRole: parsed.currentRole,
    currentTitle: parsed.currentRole,
    experienceYears: years,
    yearsExperience: years != null ? Math.round(years) : undefined,
  };
}

export function parseOverrideKeys(metadata: unknown): Set<string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return new Set();
  const overrides = (metadata as Record<string, unknown>).parseOverrides;
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return new Set();
  return new Set(
    Object.entries(overrides as Record<string, unknown>)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key),
  );
}

const PLACEHOLDER_FIRST = /^(unknown|candidate|n\/?a|none|null|test)$/i;
const PLACEHOLDER_LAST = /^(form|page|status|submittal|cover)?$/i;

export function isPlaceholderPersonName(firstName?: string | null, lastName?: string | null): boolean {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first) return true;
  if (PLACEHOLDER_FIRST.test(first) && PLACEHOLDER_LAST.test(last)) return true;
  if (PLACEHOLDER_FIRST.test(first) && PLACEHOLDER_FIRST.test(last)) return true;
  return false;
}

/** Fill first/last name when the stored values are parser placeholders. */
export function candidateIdentityFields(
  parsed: Partial<ParsedResumeResult>,
  existing: { firstName: string; lastName: string },
  overrides: Set<string> = new Set(),
  fileName?: string,
): { firstName?: string; lastName?: string } {
  if (overrides.has("firstName") || overrides.has("lastName")) {
    return { firstName: existing.firstName, lastName: existing.lastName };
  }
  const resolved = resolvedParsedIdentity(parsed, fileName);
  if (isPlaceholderPersonName(resolved.firstName, resolved.lastName)) {
    return {};
  }
  if (isPlaceholderPersonName(existing.firstName, existing.lastName)) {
    return resolved;
  }
  return {};
}

/** Name to persist on create. Prefers parser output, then the resume filename. */
export function resolvedParsedIdentity(
  parsed: Partial<ParsedResumeResult>,
  fileName?: string,
): { firstName: string; lastName: string } {
  const parsedFirst = parsed.firstName?.trim();
  const parsedLast = parsed.lastName?.trim() ?? "";
  if (
    parsedFirst &&
    !parsedFirst.startsWith("%PDF-") &&
    !isPlaceholderPersonName(parsedFirst, parsedLast)
  ) {
    return { firstName: parsedFirst, lastName: parsedLast };
  }

  const fromFile = inferNameFromResumeFileName(fileName);
  if (
    fromFile?.first_name &&
    !isPlaceholderPersonName(fromFile.first_name, fromFile.last_name ?? "")
  ) {
    return { firstName: fromFile.first_name, lastName: fromFile.last_name ?? "" };
  }

  return { firstName: "Unknown", lastName: "" };
}
