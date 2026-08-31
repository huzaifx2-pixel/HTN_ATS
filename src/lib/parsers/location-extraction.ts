import { COUNTRIES, findCountry } from "@/lib/constants/countries";
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
const ZIP_REGEX = /\b(\d{5}(?:-\d{4})?)\b/;

function normalizeCountry(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const matched = findCountry(trimmed);
  return matched || undefined;
}

function findCountryInText(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    if (lower.includes(alias)) return country;
  }
  for (const country of COUNTRIES) {
    if (country === "Global") continue;
    if (lower.includes(country.toLowerCase())) return country;
  }
  return undefined;
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
    if (!US_STATE_CODES.has(state)) return null;
    return {
      city: cityStateMatch[1].trim(),
      state,
      country: country ?? "United States",
      zipCode: zipMatch?.[1],
      fullAddress: candidateLine,
      location: undefined,
    };
  }

  if (country) {
    const withoutCountry = candidateLine.replace(new RegExp(country, "i"), "").replace(/[,|-]\s*$/, "").trim();
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
  const headerLines = text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 20);
  let best: ParsedLocation | null = null;

  for (const line of headerLines) {
    const parsed = parseLocationLine(line);
    if (!parsed) continue;
    best = parsed;
    if (parsed.city && parsed.country) break;
  }

  if (!best) {
    for (const line of headerLines) {
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
