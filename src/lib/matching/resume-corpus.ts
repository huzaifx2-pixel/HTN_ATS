import type { Candidate } from "@prisma/client";
import { normalizeText } from "@/lib/matching/recruiter-engine/text-utils";
import {
  resolveCandidateSkillsForMatching,
  resolveCertificationsForMatching,
  resolveExperienceTitlesForMatching,
  resolveResumeBulletsForMatching,
} from "@/lib/matching/structured-candidate-data";
import { parseSkills } from "@/lib/utils";
import { parseJsonStringArray, uniqueSorted } from "@/lib/matching/recruiter-engine/text-utils";

export type MatchingResumeInput = {
  resumeText?: string;
  parsedResume?: {
    skills?: unknown;
    experience?: unknown;
    education?: unknown;
    certifications?: unknown;
    structured?: unknown;
  } | null;
};

export function buildMatchingResumeCorpus(
  candidate: Candidate,
  input: MatchingResumeInput = {}
): string {
  const resumeText = input.resumeText ?? candidate.summary ?? "";
  const parsedResume = input.parsedResume ?? null;

  const parsedSkills = resolveCandidateSkillsForMatching(candidate, parsedResume);
  const legacySkills = parseJsonStringArray(parsedResume?.skills);
  const candidateSkills = uniqueSorted([
    ...parsedSkills,
    ...parseSkills(candidate.skills),
    ...legacySkills,
  ]);

  const parsedExperience = Array.isArray(parsedResume?.experience)
    ? (parsedResume.experience as Array<{
        role?: string;
        company?: string;
        description?: string | string[];
        responsibilities?: string[];
      }>)
    : [];
  const structuredTitles = resolveExperienceTitlesForMatching(candidate, parsedResume);
  const candidateTitles = uniqueSorted(
    [
      candidate.currentRole,
      candidate.currentTitle,
      candidate.headline,
      ...structuredTitles,
      ...parsedExperience.map((item) => item.role).filter(Boolean),
    ].filter((title): title is string => Boolean(title))
  );

  const structuredBullets = resolveResumeBulletsForMatching(parsedResume);
  const certifications = uniqueSorted([
    ...resolveCertificationsForMatching(candidate, parsedResume),
    ...parseJsonStringArray(parsedResume?.certifications),
  ]);

  const structured = parsedResume?.structured && typeof parsedResume.structured === "object"
    ? (parsedResume.structured as {
        awards?: Array<{ name?: { value?: string } }>;
        publications?: Array<{ title?: { value?: string } }>;
        education?: Array<{ institution?: { value?: string }; degree?: { value?: string } }>;
      })
    : null;
  const extraIntel = [
    ...(structured?.awards ?? []).map((item) => item.name?.value).filter(Boolean),
    ...(structured?.publications ?? []).map((item) => item.title?.value).filter(Boolean),
    ...(structured?.education ?? []).flatMap((item) => [item.institution?.value, item.degree?.value]).filter(Boolean),
  ] as string[];

  const experienceLines = parsedExperience.flatMap((item) => {
    const lines: string[] = [];
    if (typeof item.company === "string") lines.push(item.company);
    if (typeof item.description === "string") lines.push(item.description);
    else if (Array.isArray(item.description)) {
      lines.push(...item.description.filter((line): line is string => typeof line === "string"));
    }
    if (Array.isArray(item.responsibilities)) {
      lines.push(...item.responsibilities.filter((line): line is string => typeof line === "string"));
    }
    return lines;
  });

  const parts = uniqueSorted([
    resumeText,
    ...candidateSkills,
    ...candidateTitles,
    ...structuredBullets,
    ...certifications,
    ...extraIntel,
    ...experienceLines,
  ]);

  return normalizeText(parts.filter(Boolean).join("\n"));
}
