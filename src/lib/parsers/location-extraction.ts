import { COUNTRIES } from "@/lib/constants/countries";
import { isValidLocationString, sanitizeCandidateLocation } from "@/lib/sanitize-contact";

export interface ParsedLocation {
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  fullAddress?: string;
  location?: string;
}

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC",
]);

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  uk: "United Kingdom",
  uae: "United Arab Emirates",
};

const LOCATION_LABEL_REGEX =
  /^(?:location|address|based in|residing in|current location|city)\s*:?\s*(.+)$/i;
const CITY_STATE_REGEX = /^([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?/;
const CITY_REGION_REGEX = /^([A-Za-z][A-Za-z .'-]{1,40}),\s*([A-Za-z][A-Za-z .'-]{2,40})$/;
const ZIP_REGEX = /\b(\d{5}(?:-\d{4})?)\b/;
const JOB_CONTEXT_REGEX =
  /^(organization|company|employer|client|role|designation|duration|period|project)\b/i;
const ORG_SUFFIX_REGEX = /\b(inc|llc|ltd|corp|co|gmbh|plc)\.?$/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function knownCountry(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const matched = COUNTRIES.find((country) => country.toLowerCase() === trimmed.toLowerCase());
  return matched && matched !== "Global" ? matched : undefined;
}

function normalizeCountry(value: string): string | undefined {
  return knownCountry(value);
}

function findCountryInText(text: string): string | undefined {
  const items: Array<{ pattern: RegExp; country: string; len: number }> = [];
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.length <= 2 && !["us", "uk"].includes(alias.toLowerCase())) continue;
    items.push({
      pattern: new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i"),
      country,
      len: alias.length,
    });
  }
  for (const country of COUNTRIES) {
    if (country === "Global") continue;
    items.push({
      pattern: new RegExp(`\\b${escapeRegExp(country)}\\b`, "i"),
      country,
      len: country.length,
    });
  }
  items.sort((a, b) => b.len - a.len);
  for (const item of items) {
    if (item.pattern.test(text)) return item.country;
  }
  return undefined;
}

function previousNonEmpty(lines: string[], index: number): string | undefined {
  for (let i = index - 1; i >= 0; i--) {
    if (lines[i]) return lines[i];
  }
  return undefined;
}

function isJobSiteLocation(line: string, previous?: string): boolean {
  if (!LOCATION_LABEL_REGEX.test(line)) return false;
  if (!previous) return false;
  return JOB_CONTEXT_REGEX.test(previous) || /^project\s*#/i.test(previous);
}

function isLikelyProseLine(line: string): boolean {
  return !isValidLocationString(line) && line.length > 35;
}

function formatLocationLabel(location: ParsedLocation): string | undefined {
  const parts = [location.city, location.state, location.country].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return location.fullAddress?.trim() || undefined;
}

function parseLocationLine(line: string): ParsedLocation | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80 || isLikelyProseLine(trimmed)) return null;
  if (trimmed.includes("@")) return null;

  const labelMatch = trimmed.match(LOCATION_LABEL_REGEX);
  const candidateLine = labelMatch?.[1]?.trim() ?? trimmed;

  const cityStateMatch = candidateLine.match(CITY_STATE_REGEX);
  const zipMatch = candidateLine.match(ZIP_REGEX);
  const country = findCountryInText(candidateLine);

  if (cityStateMatch) {
    const state = cityStateMatch[2];
    if (US_STATE_CODES.has(state)) {
      return {
        city: cityStateMatch[1].trim(),
        state,
        country: country ?? "United States",
        zipCode: zipMatch?.[1],
        fullAddress: candidateLine,
        location: undefined,
      };
    }
  }

  const cityRegionMatch = candidateLine.match(CITY_REGION_REGEX);
  if (cityRegionMatch) {
    const city = cityRegionMatch[1].trim();
    const region = cityRegionMatch[2].trim();
    if (ORG_SUFFIX_REGEX.test(region)) return null;
    const regionCountry = knownCountry(region) ?? findCountryInText(region);
    if (regionCountry) {
      return {
        city,
        country: regionCountry,
        zipCode: zipMatch?.[1],
        fullAddress: candidateLine,
      };
    }
    if (region.length >= 3 && city.length >= 2) {
      return {
        city,
        state: region,
        country,
        zipCode: zipMatch?.[1],
        fullAddress: candidateLine,
      };
    }
  }

  if (country) {
    const withoutCountry = candidateLine
      .replace(new RegExp(`\\b${escapeRegExp(country)}\\b`, "i"), "")
      .replace(/[,|-]\s*$/, "")
      .trim();
    const parts = withoutCountry.split(",").map((part) => part.trim()).filter(Boolean);
    return {
      city: parts[0] || undefined,
      state: parts[1] && parts[1].length <= 3 ? parts[1].toUpperCase() : undefined,
      country,
      zipCode: zipMatch?.[1],
      fullAddress: candidateLine,
    };
  }

  if (/^(remote|hybrid|onsite|on-site)$/i.test(candidateLine)) {
    return { location: candidateLine, fullAddress: candidateLine };
  }

  return null;
}

export function extractLocation(text: string): ParsedLocation {
  const lines = text.split("\n").map((line) => line.trim());
  const nonEmpty = lines.filter(Boolean);
  let best: ParsedLocation | null = null;
  let nonEmptyIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const inHeader = nonEmptyIndex < 15;
    nonEmptyIndex += 1;
    const labeled = LOCATION_LABEL_REGEX.test(line);
    if (!inHeader && !labeled) continue;
    const previous = previousNonEmpty(lines, i);
    if (isJobSiteLocation(line, previous)) continue;

    const parsed = parseLocationLine(line);
    if (!parsed) continue;
    best = parsed;
    if (parsed.city && parsed.country) break;
  }

  if (!best) {
    for (let i = 0; i < Math.min(nonEmpty.length, 15); i++) {
      const line = nonEmpty[i];
      if (line.length > 60 || isLikelyProseLine(line)) continue;
      const country = findCountryInText(line);
      if (country && isValidLocationString(line)) {
        best = { country, fullAddress: line, location: line };
        break;
      }
    }
  }

  if (!best) return {};

  best.location = sanitizeCandidateLocation(formatLocationLabel(best) ?? best.fullAddress);
  if (best.fullAddress) {
    best.fullAddress = sanitizeCandidateLocation(best.fullAddress);
  }
  if (best.country) best.country = normalizeCountry(best.country);
  if (!best.location && !best.city && !best.state && !best.country) {
    return {};
  }
  return best;
}

export function extractWorkAuthorization(text: string): string | undefined {
  const patterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\bU\.?S\.?\s+Citizen\b/i, label: "US Citizen" },
    { regex: /\bGreen Card\b|\bPermanent Resident\b/i, label: "Green Card" },
    { regex: /\bH-?1B\b/i, label: "H1B" },
    { regex: /\bH-?4\s*EAD\b/i, label: "H4 EAD" },
    { regex: /\bOPT\b/i, label: "OPT" },
    { regex: /\bCPT\b/i, label: "CPT" },
    { regex: /\bTN Visa\b/i, label: "TN Visa" },
    { regex: /\bRequires Sponsorship\b/i, label: "Requires Sponsorship" },
    { regex: /\bAuthorized to Work\b/i, label: "Authorized to Work" },
    { regex: /\bNo Sponsorship Required\b/i, label: "Authorized to Work" },
  ];

  for (const { regex, label } of patterns) {
    if (regex.test(text)) return label;
  }
  return undefined;
}
