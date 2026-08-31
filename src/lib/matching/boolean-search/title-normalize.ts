/** Recruiter title normalization: seniority, compounds, and parentheticals. */

const ROLE_ALIASES: Record<string, string> = {
  researcher: "Research Scientist",
  research: "Research Scientist",
  scientist: "Research Scientist",
  prof: "Professor",
  programmer: "Developer",
  coder: "Developer",
};

const SENIORITY_PREFIX = /^(Senior|Junior|Lead|Principal|Staff|Associate|Intern)\s+/i;
const SENIORITY_SUFFIX = /\s+(I{1,3}|IV|V|\d+)$/i;

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function applyAbbreviationExpansions(title: string): string {
  return title
    .replace(/\bSr\.?\b/gi, "Senior")
    .replace(/\bJr\.?\b/gi, "Junior")
    .replace(/\bMgr\.?\b/gi, "Manager")
    .replace(/\bDir\.?\b/gi, "Director")
    .replace(/\bEngr?\.?\b/gi, "Engineer")
    .replace(/\bSWE\b/g, "Software Engineer")
    .replace(/\bSDE\b/g, "Software Engineer")
    .replace(/\bSRE\b/g, "Site Reliability Engineer")
    .replace(/\bRN\b/g, "Registered Nurse")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasStandaloneRole(value: string): string {
  const lower = value.trim().toLowerCase();
  return ROLE_ALIASES[lower] ?? value.trim();
}

function splitCompoundTitle(title: string): string[] {
  if (title.includes("/")) {
    const parts = title
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const left = parts[0];
      const right = aliasStandaloneRole(parts.slice(1).join(" / "));
      return dedupe([left, right]);
    }
  }

  if (title.includes("|")) {
    return dedupe(title.split("|").map((part) => part.trim()).filter(Boolean));
  }

  const andParts = title.split(/\s+&\s+|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  if (andParts.length === 2 && andParts.every((part) => part.split(/\s+/).length <= 4)) {
    return dedupe(andParts.map(aliasStandaloneRole));
  }

  return [title];
}

function withSeniorityVariants(title: string): string[] {
  const variants = [title];
  const withoutPrefix = title.replace(SENIORITY_PREFIX, "").trim();
  if (withoutPrefix && withoutPrefix.toLowerCase() !== title.toLowerCase()) {
    variants.push(withoutPrefix);
  }
  const withoutSuffix = title.replace(SENIORITY_SUFFIX, "").trim();
  if (withoutSuffix && withoutSuffix.toLowerCase() !== title.toLowerCase()) {
    variants.push(withoutSuffix);
  }
  return variants;
}

export type NormalizedJobTitle = {
  primary: string;
  variants: string[];
};

/**
 * Normalize a raw job title into a primary title plus search variants.
 * Example: "Sr Software Engineer" → Senior Software Engineer, Software Engineer
 * Example: "Chemistry Professor/Researcher (PhD)" → Chemistry Professor, Research Scientist
 */
export function normalizeJobTitle(raw: string): NormalizedJobTitle {
  let cleaned = raw.replace(/\u00a0/g, " ").trim();
  cleaned = cleaned.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  cleaned = cleaned.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  cleaned = applyAbbreviationExpansions(cleaned);

  if (!cleaned) {
    return { primary: raw.trim(), variants: raw.trim() ? [raw.trim()] : [] };
  }

  const variants: string[] = [];
  for (const part of splitCompoundTitle(cleaned)) {
    const aliased = aliasStandaloneRole(part);
    variants.push(...withSeniorityVariants(aliased));
  }

  const unique = dedupe(variants.filter(Boolean));
  return {
    primary: unique[0] ?? cleaned,
    variants: unique,
  };
}
