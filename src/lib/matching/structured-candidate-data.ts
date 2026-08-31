import type { Candidate } from "@prisma/client";
import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";
import { parseSkills } from "@/lib/utils";
import { parseJsonStringArray } from "@/lib/matching/recruiter-engine/text-utils";
import { normalizeSkill } from "@/lib/parsers/pipeline/normalize";
import { expandSkillFamily } from "@/lib/parsers/pipeline/skill-taxonomy";

const MIN_SKILL_CONFIDENCE = 0.55;

export function getStructuredParse(parsedResume?: {
  structured?: unknown;
} | null): StructuredParseResult | null {
  const raw = parsedResume?.structured;
  if (!raw || typeof raw !== "object") return null;
  return raw as StructuredParseResult;
}

export function resolveCandidateSkillsForMatching(
  candidate: Candidate,
  parsedResume?: { structured?: unknown; skills?: unknown } | null
): string[] {
  const structured = getStructuredParse(parsedResume ?? null);
  if (structured?.skills?.length) {
    return structured.skills
      .filter((s) => s.skill.confidence >= MIN_SKILL_CONFIDENCE)
      .flatMap((s) => expandSkillFamily(normalizeSkill(s.skill.value)))
      .map((name) => normalizeSkill(name));
  }
  return parseSkills(candidate.skills).map(normalizeSkill);
}

export function resolveExperienceYearsForMatching(
  candidate: Candidate,
  parsedResume?: { structured?: unknown } | null
): number | null {
  const structured = getStructuredParse(parsedResume ?? null);
  if (structured?.metrics?.totalYears && structured.metrics.totalYears > 0) {
    return structured.metrics.totalYears;
  }
  return candidate.experienceYears ?? candidate.yearsExperience ?? null;
}

export function resolveResumeText(
  candidate: Candidate,
  parsedResume?: { rawText?: string | null; structured?: unknown } | null,
  fallback?: string
): string {
  return (
    parsedResume?.rawText ??
    getStructuredParse(parsedResume ?? null)?.rawText ??
    fallback ??
    candidate.summary ??
    ""
  );
}

export function structuredExperienceEntries(parsedResume?: { structured?: unknown } | null) {
  const structured = getStructuredParse(parsedResume ?? null);
  return structured?.experience ?? [];
}

export function resolveCertificationsForMatching(
  candidate: Candidate,
  parsedResume?: { structured?: unknown; certifications?: unknown } | null
): string[] {
  const structured = getStructuredParse(parsedResume ?? null);
  if (structured?.certifications?.length) {
    return structured.certifications
      .filter((c) => c.name.confidence >= 0.5)
      .map((c) => c.name.value);
  }
  return parseJsonStringArray(parsedResume?.certifications);
}

export function resolveExperienceTitlesForMatching(
  candidate: Candidate,
  parsedResume?: { structured?: unknown; experience?: unknown } | null
): string[] {
  const structured = getStructuredParse(parsedResume ?? null);
  if (structured?.experience?.length) {
    return structured.experience
      .filter((e) => e.jobTitle.confidence >= 0.5)
      .map((e) => e.jobTitle.value);
  }
  const legacy = Array.isArray(parsedResume?.experience)
    ? (parsedResume!.experience as Array<{ role?: string }>)
    : [];
  return legacy.map((e) => e.role).filter((r): r is string => Boolean(r));
}

export function resolveResumeBulletsForMatching(
  parsedResume?: { structured?: unknown; experience?: unknown } | null
): string[] {
  const structured = getStructuredParse(parsedResume ?? null);
  if (structured?.experience?.length) {
    return structured.experience.flatMap((e) => [
      ...e.responsibilities,
      ...e.achievements,
      ...(e.description ? [e.description] : []),
    ]);
  }
  const legacy = Array.isArray(parsedResume?.experience)
    ? (parsedResume!.experience as Array<{ description?: string; responsibilities?: string[] }>)
    : [];
  return legacy.flatMap((e) => [
    ...(e.responsibilities ?? []).filter((line): line is string => typeof line === "string"),
    ...(typeof e.description === "string" ? [e.description] : []),
  ]);
}
