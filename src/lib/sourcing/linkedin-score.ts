import { runBooleanSearch } from "@/lib/matching/boolean-search";
import { termMatches } from "@/lib/matching/boolean-search/evaluate";
import { booleanTermList } from "@/lib/sourcing/linkedin-xray";
import type { ParsedLinkedInSerp } from "@/lib/sourcing/linkedin-serp-parse";

export type LinkedInMatchScores = {
  matchScore: number;
  skillMatch: number;
  experienceMatch: number;
  locationMatch: number;
  educationMatch: number;
  matchLabel: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function matchLabelForScore(score: number) {
  if (score >= 95) return "Excellent Match";
  if (score >= 85) return "Very Good Match";
  if (score >= 70) return "Good Match";
  return "Fair Match";
}

export function scoreLinkedInSerp(
  parsed: ParsedLinkedInSerp,
  job: {
    booleanSearch?: string | null;
    location?: string | null;
    city?: string | null;
    country?: string | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
  }
): LinkedInMatchScores {
  const corpus = [parsed.fullName, parsed.headline, parsed.currentTitle, parsed.currentCompany, parsed.location, parsed.education, parsed.snippet, ...(parsed.skills ?? [])]
    .filter(Boolean)
    .join("\n");

  const terms = booleanTermList(job.booleanSearch ?? "");
  const matchedTerms = terms.filter((term) => termMatches(corpus, term));
  const skillMatch = terms.length > 0 ? (matchedTerms.length / terms.length) * 100 : 55;

  const booleanResult = job.booleanSearch?.trim()
    ? runBooleanSearch(job.booleanSearch, corpus)
    : null;
  const booleanBoost = booleanResult && booleanResult.ok && booleanResult.passes ? 12 : 0;

  const minExp = job.experienceMin ?? 0;
  let experienceMatch = 55;
  if (parsed.experienceYears != null) {
    if (parsed.experienceYears >= minExp) {
      experienceMatch = 90 + Math.min(10, parsed.experienceYears - minExp);
    } else if (minExp > 0) {
      experienceMatch = Math.max(20, (parsed.experienceYears / minExp) * 80);
    }
  }

  const locationNeedles = [job.city, job.location, job.country].filter(Boolean) as string[];
  const locationMatch =
    locationNeedles.length === 0
      ? 50
      : locationNeedles.some((needle) => corpus.toLowerCase().includes(needle.toLowerCase()))
        ? 92
        : parsed.location
          ? 40
          : 25;

  const educationMatch = parsed.education ? 80 : 45;

  const matchScore = clamp(
    skillMatch * 0.45 +
      experienceMatch * 0.2 +
      locationMatch * 0.15 +
      educationMatch * 0.08 +
      (booleanBoost ? 12 : 0)
  );

  return {
    matchScore,
    skillMatch: clamp(skillMatch),
    experienceMatch: clamp(experienceMatch),
    locationMatch: clamp(locationMatch),
    educationMatch: clamp(educationMatch),
    matchLabel: matchLabelForScore(matchScore),
  };
}
