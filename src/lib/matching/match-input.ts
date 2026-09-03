import { createHash } from "crypto";
import {
  computeJobMatchInputHash,
  matchInputFieldsFromRequirements,
} from "@/lib/jobs/match-input-hash";

export type MatchRowSnapshot = {
  score: number;
  skillsMatch: number;
  experienceMatch: number;
  descriptionMatch: number;
  semanticScore: number;
  matchStatus?: string | null;
  retrievalScore?: number;
  missingSkills: string[];
  reason: string | null;
};

export function jobMatchFingerprint(job: {
  title: string;
  description: string | null;
  location: string | null;
  requirements: unknown;
  booleanSearch?: string | null;
}): string {
  const inputHash = computeJobMatchInputHash(matchInputFieldsFromRequirements(job));
  const booleanSearch = job.booleanSearch?.trim() ?? "";
  return createHash("sha256").update(`${inputHash}:${booleanSearch}:v3-boolean-location`).digest("hex");
}

export function readLastMatchedFingerprint(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>).lastMatchedFingerprint;
  return typeof value === "string" ? value : undefined;
}

export function hasScorableResume(
  candidate: { skills?: unknown; summary?: string | null },
  parsedResume?: { rawText?: string | null; skills?: unknown } | null,
): boolean {
  const rawText = parsedResume?.rawText?.trim() ?? "";
  if (rawText.length >= 120) return true;

  const skills =
    (Array.isArray(parsedResume?.skills) ? parsedResume.skills : null) ??
    (Array.isArray(candidate.skills) ? candidate.skills : []);
  return skills.length > 0;
}

export function matchRowsEqual(a: MatchRowSnapshot, b: MatchRowSnapshot): boolean {
  return (
    a.score === b.score &&
    a.skillsMatch === b.skillsMatch &&
    a.experienceMatch === b.experienceMatch &&
    a.descriptionMatch === b.descriptionMatch &&
    a.semanticScore === b.semanticScore &&
    (a.matchStatus ?? null) === (b.matchStatus ?? null) &&
    (a.retrievalScore ?? 0) === (b.retrievalScore ?? 0) &&
    a.reason === b.reason &&
    JSON.stringify(a.missingSkills) === JSON.stringify(b.missingSkills)
  );
}

export function candidateMatchInputsChanged(
  before: {
    skills?: unknown;
    experienceYears?: number | null;
    currentRole?: string | null;
    currentCompany?: string | null;
    location?: string | null;
    city?: string | null;
    country?: string | null;
  },
  after: {
    skills?: unknown;
    experienceYears?: number | null;
    currentRole?: string | null;
    currentCompany?: string | null;
    location?: string | null;
    city?: string | null;
    country?: string | null;
  },
): boolean {
  return (
    JSON.stringify(before.skills ?? null) !== JSON.stringify(after.skills ?? null) ||
    before.experienceYears !== after.experienceYears ||
    before.currentRole !== after.currentRole ||
    before.currentCompany !== after.currentCompany ||
    before.location !== after.location ||
    before.city !== after.city ||
    before.country !== after.country
  );
}

export function mergeJobMetadataFingerprint(
  metadata: unknown,
  fingerprint: string,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, lastMatchedFingerprint: fingerprint };
}
