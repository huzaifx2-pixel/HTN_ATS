import {
  SKILL_SYNONYM_GROUPS,
  TITLE_SYNONYM_GROUPS,
  TRANSFERABLE_PLATFORM_PAIRS,
} from "@/lib/matching/recruiter-engine/synonyms";
import type { MatchConfidence, SkillMatchStatus } from "@/lib/matching/recruiter-engine/types";

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\w\s/+.-]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

export function uniqueSorted(values: unknown[]) {
  const strings = values.flatMap((value) => {
    if (typeof value === "string") return [value];
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    return [String(value)];
  });

  return [...new Set(strings.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function findSynonymGroup(term: string, groups: string[][]) {
  const normalized = normalizeText(term);
  return groups.find((group) => group.some((item) => normalized.includes(normalizeText(item))));
}

export function termsEquivalent(a: string, b: string, groups: string[][] = SKILL_SYNONYM_GROUPS) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const group = findSynonymGroup(left, groups) ?? findSynonymGroup(right, groups);
  if (!group) return false;
  return group.some((item) => left.includes(normalizeText(item)) || right.includes(normalizeText(item)));
}

export function findEvidenceSnippet(resumeText: string, term: string, radius = 80) {
  const normalizedResume = normalizeText(resumeText);
  const normalizedTerm = normalizeText(term);
  if (!normalizedResume || !normalizedTerm) return "Not Found";

  const directIndex = normalizedResume.indexOf(normalizedTerm);
  if (directIndex >= 0) {
    const start = Math.max(0, directIndex - radius);
    const end = Math.min(normalizedResume.length, directIndex + normalizedTerm.length + radius);
    return resumeText.slice(start, end).trim() || "Not Found";
  }

  const group = findSynonymGroup(normalizedTerm, SKILL_SYNONYM_GROUPS);
  if (group) {
    for (const synonym of group) {
      const idx = normalizedResume.indexOf(normalizeText(synonym));
      if (idx >= 0) {
        const start = Math.max(0, idx - radius);
        const end = Math.min(normalizedResume.length, idx + synonym.length + radius);
        return resumeText.slice(start, end).trim();
      }
    }
  }

  return "Not Found";
}

export function resumeContainsTerm(resumeText: string, term: string) {
  return findEvidenceSnippet(resumeText, term) !== "Not Found";
}

export function classifySkillMatch(
  resumeText: string,
  skill: string,
  candidateSkills: string[]
): { status: SkillMatchStatus; evidence: string; reasoning: string } {
  const evidenceDirect = findEvidenceSnippet(resumeText, skill);
  const exactSkill = candidateSkills.some((item) => termsEquivalent(item, skill, SKILL_SYNONYM_GROUPS));
  if (exactSkill || evidenceDirect !== "Not Found") {
    const exact = candidateSkills.some((item) => normalizeText(item) === normalizeText(skill));
    return {
      status: exact ? "Exact Match" : evidenceDirect !== "Not Found" ? "Semantic Match" : "Equivalent Match",
      evidence:
        evidenceDirect !== "Not Found"
          ? evidenceDirect
          : candidateSkills.find((item) => termsEquivalent(item, skill)) ?? "Found in skills list",
      reasoning: exact
        ? "Skill appears explicitly in the candidate profile or resume."
        : "Skill is supported by resume context or an equivalent listed skill.",
    };
  }

  const equivalent = candidateSkills.find((item) => termsEquivalent(item, skill, SKILL_SYNONYM_GROUPS));
  if (equivalent) {
    return {
      status: "Equivalent Match",
      evidence: equivalent,
      reasoning: `Equivalent skill "${equivalent}" satisfies the "${skill}" requirement.`,
    };
  }

  for (const [required, found] of TRANSFERABLE_PLATFORM_PAIRS) {
    if (!termsEquivalent(skill, required)) continue;
    if (resumeContainsTerm(resumeText, found) || candidateSkills.some((item) => termsEquivalent(item, found))) {
      return {
        status: "Transferable",
        evidence:
          findEvidenceSnippet(resumeText, found) !== "Not Found"
            ? findEvidenceSnippet(resumeText, found)
            : found,
        reasoning: `Direct "${skill}" evidence not found, but transferable experience with "${found}" is present.`,
      };
    }
  }

  return {
    status: "Missing",
    evidence: "Not Found",
    reasoning: `No explicit or semantic evidence for "${skill}" was found in the resume.`,
  };
}

export function titleAlignmentScore(jobTitle: string, candidateTitles: string[]) {
  const normalizedJob = normalizeText(jobTitle);
  if (!normalizedJob) return { score: 0, matched: [] as string[], reasoning: "Job title unavailable." };

  const matched = candidateTitles.filter((title) => {
    if (!title) return false;
    if (termsEquivalent(title, jobTitle, TITLE_SYNONYM_GROUPS)) return true;
    const jobTokens = new Set(tokenize(jobTitle));
    const titleTokens = tokenize(title);
    const overlap = titleTokens.filter((token) => jobTokens.has(token)).length;
    return overlap >= Math.min(2, jobTokens.size);
  });

  if (matched.length > 0) {
    return {
      score: 1,
      matched,
      reasoning: `Candidate title history aligns with the target role (${matched.join(", ")}).`,
    };
  }

  const partial = candidateTitles.some((title) => tokenize(title).some((token) => normalizedJob.includes(token)));
  return {
    score: partial ? 0.5 : 0,
    matched: [],
    reasoning: partial
      ? "Partial title overlap detected, but no strong equivalent title match was found."
      : "No equivalent or closely related title match was found in the resume.",
  };
}

export function keywordCoverage(required: string[], resumeText: string, candidateSkills: string[]) {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of uniqueSorted(required)) {
    const evaluation = classifySkillMatch(resumeText, keyword, candidateSkills);
    if (evaluation.status === "Missing") missing.push(keyword);
    else matched.push(keyword);
  }

  const coverage = required.length === 0 ? 100 : Math.round((matched.length / required.length) * 100);
  return { matched, missing, coverage };
}

export function extractBulletLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter((line) => line.length > 12);
}

export function estimateYearsFromResume(resumeText: string, fallback?: number | null) {
  if (fallback != null && fallback > 0) return fallback;
  const matches = [...resumeText.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/gi)];
  if (matches.length === 0) return null;
  return Math.max(...matches.map((match) => Number(match[1])));
}

export function confidenceFromEvidence(evidence: string, scoreRatio: number): MatchConfidence {
  if (evidence === "Not Found" || scoreRatio === 0) return "Low";
  if (scoreRatio >= 0.75) return "High";
  if (scoreRatio >= 0.4) return "Medium";
  return "Low";
}

export function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

export function scoreToCategory(score: number) {
  if (score >= 90) return "Excellent Match" as const;
  if (score >= 75) return "Strong Match" as const;
  if (score >= 60) return "Moderate Match" as const;
  if (score >= 40) return "Weak Match" as const;
  return "Poor Match" as const;
}

export function scoreToRecommendation(score: number) {
  if (score >= 90) return "Highly Recommended" as const;
  if (score >= 75) return "Recommended" as const;
  if (score >= 60) return "Consider" as const;
  if (score >= 40) return "Not Recommended" as const;
  return "Reject" as const;
}

export function parseCommaList(value?: string | null) {
  if (!value) return [];
  return uniqueSorted(value.split(","));
}

export function parseJsonStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return uniqueSorted(value.filter((item): item is string => typeof item === "string"));
}
