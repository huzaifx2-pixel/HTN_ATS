import type { Candidate, Job } from "@prisma/client";
import { normalizeText } from "@/lib/matching/recruiter-engine/text-utils";

const US_STATE_BY_ABBR: Record<string, string> = {
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming",
  dc: "district of columbia",
};

const US_ABBR_BY_STATE = Object.fromEntries(
  Object.entries(US_STATE_BY_ABBR).map(([abbr, name]) => [name, abbr]),
);

const COUNTRY_ALIASES: Record<string, string> = {
  us: "us",
  usa: "us",
  "u s": "us",
  "u s a": "us",
  "united states": "us",
  "united states of america": "us",
  america: "us",
  uk: "gb",
  "u k": "gb",
  "united kingdom": "gb",
  "great britain": "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  india: "in",
  bharat: "in",
  canada: "ca",
  australia: "au",
  germany: "de",
  france: "fr",
  uae: "ae",
  "united arab emirates": "ae",
};

function canonicalizeCountry(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = normalizeText(value).trim();
  if (!key) return null;
  return COUNTRY_ALIASES[key] ?? key;
}

function expandLocationToken(token: string): string[] {
  const normalized = normalizeText(token).trim();
  if (!normalized) return [];

  const out = new Set<string>([normalized]);
  const compact = normalized.replace(/\s+/g, "");

  if (US_STATE_BY_ABBR[compact]) {
    out.add(compact);
    out.add(US_STATE_BY_ABBR[compact]);
    out.add("us");
    out.add("united states");
  }
  if (US_ABBR_BY_STATE[normalized]) {
    out.add(US_ABBR_BY_STATE[normalized]);
    out.add("us");
    out.add("united states");
  }

  const country = canonicalizeCountry(normalized);
  if (country) out.add(country);

  return [...out];
}

/** Keep city names and 2-letter state/country codes (AZ, NY, US). */
function locationTokens(...values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(/[,|/·]/)) {
      const token = normalizeText(part).trim();
      if (!token) continue;
      // Allow 2-char codes (state/country); ignore single letters.
      if (token.length < 2) continue;
      for (const expanded of expandLocationToken(token)) {
        if (expanded.length >= 2) tokens.add(expanded);
      }
    }
    const normalized = normalizeText(value).trim();
    if (normalized.length >= 2) {
      for (const expanded of expandLocationToken(normalized)) {
        if (expanded.length >= 2) tokens.add(expanded);
      }
    }
  }
  return [...tokens];
}

function textMentionsAny(text: string, tokens: string[]): boolean {
  const normalized = normalizeText(text);
  return tokens.some((token) => {
    if (token.length < 2) return false;
    // Short tokens (us, az, ny) must be whole words — avoid matching inside "business"/"status".
    if (token.length <= 3) {
      return new RegExp(`(?:^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`).test(normalized);
    }
    return normalized.includes(token);
  });
}

function inferJobCountry(job: Job, jobTokens: string[]): string | null {
  const explicit = canonicalizeCountry(job.country);
  if (explicit) return explicit;
  if (jobTokens.some((token) => token === "us" || token === "united states")) return "us";
  return null;
}

function candidateCountries(candidate: Candidate, candidateTokens: string[]): string[] {
  const countries = new Set<string>();
  const explicit = canonicalizeCountry(candidate.country);
  if (explicit) countries.add(explicit);
  for (const token of candidateTokens) {
    const country = canonicalizeCountry(token);
    if (country && (COUNTRY_ALIASES[token] || country.length === 2)) countries.add(country);
  }
  return [...countries];
}

export function evaluateLocationMatch(job: Job, candidate: Candidate, resumeText: string) {
  const jobCountry = job.country?.trim();
  const locationBlob = `${job.location ?? ""} ${job.city ?? ""} ${job.workplaceType ?? ""}`;
  const jobIsRemote = Boolean(job.remote) || /\bremote\b/i.test(locationBlob);
  const jobIsGlobal =
    jobCountry === "Global" ||
    (!jobCountry && !job.city?.trim() && !job.location?.trim() && !jobIsRemote);
  const jobTokens = locationTokens(job.location, job.city, job.country, jobIsRemote ? "remote" : undefined);
  const inferredJobCountry = inferJobCountry(job, jobTokens);

  const candidateTokens = locationTokens(
    candidate.city,
    candidate.location,
    candidate.country,
    candidate.workAuthorization,
  );
  const candCountries = candidateCountries(candidate, candidateTokens);

  const resumeSnippet = resumeText.slice(0, 4000);

  if (jobIsGlobal) {
    return {
      scoreRatio: 1,
      matched: candidateTokens.length ? candidateTokens.slice(0, 4) : ["Global role"],
      missing: [] as string[],
      reasoning: "Job location is global — no geographic restriction.",
      confidence: "Medium" as const,
    };
  }

  if (jobIsRemote) {
    return {
      scoreRatio: 1,
      matched: ["Remote"],
      missing: [] as string[],
      reasoning: "Role is remote — location is not a geographic restriction.",
      confidence: "Medium" as const,
    };
  }

  if (candidateTokens.length === 0 && !textMentionsAny(resumeSnippet, jobTokens)) {
    return {
      scoreRatio: 0,
      matched: [] as string[],
      missing: [job.location ?? job.country ?? "Location"],
      reasoning: "Candidate location was not found in profile or resume contact section.",
      confidence: "Low" as const,
    };
  }

  const overlap = jobTokens.filter((token) =>
    candidateTokens.some((candidateToken) => candidateToken.includes(token) || token.includes(candidateToken)),
  );
  const resumeOverlap = jobTokens.filter((token) => textMentionsAny(resumeSnippet, [token]));

  // Prefer city/state overlap over broad country aliases.
  const geographicOverlap = overlap.filter((token) => token !== "us" && token !== "united states");
  if (geographicOverlap.length > 0 || resumeOverlap.some((token) => token !== "us" && token !== "united states")) {
    const matched = [...new Set([...geographicOverlap, ...resumeOverlap])];
    return {
      scoreRatio: geographicOverlap.length > 0 ? 1 : 0.75,
      matched,
      missing: [] as string[],
      reasoning:
        geographicOverlap.length > 0
          ? `Location overlap found: ${matched.slice(0, 4).join(", ")}.`
          : `Resume text mentions job location terms: ${matched.slice(0, 4).join(", ")}.`,
      confidence: geographicOverlap.length > 0 ? ("High" as const) : ("Medium" as const),
    };
  }

  if (inferredJobCountry && candCountries.includes(inferredJobCountry)) {
    return {
      scoreRatio: 0.7,
      matched: [inferredJobCountry.toUpperCase()],
      missing: job.city || job.location ? [job.city || job.location || ""].filter(Boolean) : [],
      reasoning: `Candidate country matches the job country (${inferredJobCountry.toUpperCase()}).`,
      confidence: "Medium" as const,
    };
  }

  if (job.country && candidate.country && canonicalizeCountry(job.country) === canonicalizeCountry(candidate.country)) {
    return {
      scoreRatio: 0.85,
      matched: [candidate.country],
      missing: job.location ? [job.location] : [],
      reasoning: `Candidate country (${candidate.country}) matches the job country.`,
      confidence: "Medium" as const,
    };
  }

  if (overlap.length > 0 || resumeOverlap.length > 0) {
    return {
      scoreRatio: overlap.length > 0 ? 0.65 : 0.55,
      matched: [...new Set([...overlap, ...resumeOverlap])],
      missing: [] as string[],
      reasoning: `Broad location overlap found: ${[...new Set([...overlap, ...resumeOverlap])].slice(0, 4).join(", ")}.`,
      confidence: "Low" as const,
    };
  }

  return {
    scoreRatio: 0,
    matched: [] as string[],
    missing: [job.location ?? job.country ?? "Location"],
    reasoning: "Candidate location does not clearly match the job location requirements.",
    confidence: "Low" as const,
  };
}
