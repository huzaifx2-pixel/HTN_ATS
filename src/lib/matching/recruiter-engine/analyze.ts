import type { Candidate, Job } from "@prisma/client";
import {
  COMMON_TOOLS,
  INDUSTRY_KEYWORDS,
  RESPONSIBILITY_EQUIVALENCES,
  SOFT_SKILL_EVIDENCE,
} from "@/lib/matching/recruiter-engine/synonyms";
import type {
  CriticalMissingRequirement,
  DetailedReasoningEntry,
  RecruiterMatchAnalysis,
  SectionScoreDetail,
  SkillEvaluation,
  TransferableSkillEntry,
} from "@/lib/matching/recruiter-engine/types";
import {
  classifySkillMatch,
  confidenceFromEvidence,
  estimateYearsFromResume,
  extractBulletLines,
  findEvidenceSnippet,
  keywordCoverage,
  normalizeText,
  parseJsonStringArray,
  resumeContainsTerm,
  roundScore,
  scoreToCategory,
  scoreToQualificationStatus,
  scoreToRecommendation,
  titleAlignmentScore,
  uniqueSorted,
} from "@/lib/matching/recruiter-engine/text-utils";
import { parseSkills } from "@/lib/utils";
import { extractMatchingKeywords } from "@/lib/matching/text-similarity";
import { evaluateLocationMatch } from "@/lib/matching/location-match";
import {
  resolveCandidateSkillsForMatching,
  resolveExperienceYearsForMatching,
  resolveCertificationsForMatching,
  resolveExperienceTitlesForMatching,
  resolveResumeBulletsForMatching,
} from "@/lib/matching/structured-candidate-data";
import { runBooleanSearch } from "@/lib/matching/boolean-search";
import { buildMatchingResumeCorpus } from "@/lib/matching/resume-corpus";
import { attachBooleanSearch } from "@/lib/matching/boolean-search/analysis";
import { parseJobRequirementTiers } from "@/lib/matching/recruiter-engine/requirements";
import {
  criticalEvidencePasses,
  evidenceFromSkillStatus,
  evidenceScoreRatio,
} from "@/lib/matching/recruiter-engine/evidence";

/** Matching uses Boolean search and location only. Other sections stay inactive. */
const SECTION_MAX = {
  criticalRequirements: 0,
  jobTitle: 0,
  requiredSkills: 0,
  preferredSkills: 0,
  experience: 0,
  responsibilities: 0,
  industry: 0,
  education: 0,
  certifications: 0,
  tools: 0,
  softSkills: 0,
  location: 50,
  booleanSearch: 50,
} as const;

function inactiveSection(reasoning: string): SectionScoreDetail {
  return {
    score: 0,
    maxScore: 0,
    confidence: "Low",
    reasoning,
    matched: [],
    missing: [],
  };
}

function ratioToSection(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return score / maxScore;
}

export interface RecruiterAnalyzeInput {
  job: Job;
  candidate: Candidate;
  resumeText?: string;
  parsedResume?: {
    skills?: unknown;
    experience?: unknown;
    education?: unknown;
    certifications?: unknown;
    structured?: unknown;
  } | null;
}

function buildResumeCorpus(
  candidate: Candidate,
  resumeText: string,
  parsedResume?: RecruiterAnalyzeInput["parsedResume"]
) {
  const parsedSkills = resolveCandidateSkillsForMatching(candidate, parsedResume ?? null);
  const legacySkills = parseJsonStringArray(parsedResume?.skills);
  const candidateSkills = uniqueSorted([
    ...parsedSkills,
    ...parseSkills(candidate.skills).map((s) => s),
    ...legacySkills,
  ]);
  const parsedExperience = Array.isArray(parsedResume?.experience)
    ? (parsedResume?.experience as Array<{ role?: string; company?: string; description?: string }>)
    : [];
  const structuredTitles = resolveExperienceTitlesForMatching(candidate, parsedResume ?? null);
  const candidateTitles = uniqueSorted(
    [
      candidate.currentRole,
      candidate.currentTitle,
      ...structuredTitles,
      ...parsedExperience.map((item) => item.role).filter(Boolean),
    ].filter((title): title is string => Boolean(title))
  );
  const structuredBullets = resolveResumeBulletsForMatching(parsedResume ?? null);
  const resumeBullets = uniqueSorted([
    ...extractBulletLines(resumeText),
    ...structuredBullets,
    ...parsedExperience.flatMap((item) => extractBulletLines(item.description ?? "")),
  ]);
  const parsedEducation = Array.isArray(parsedResume?.education)
    ? (parsedResume.education as Array<{ degree?: string; field?: string; institution?: string }>)
    : [];
  const parsedCertifications = uniqueSorted([
    ...resolveCertificationsForMatching(candidate, parsedResume ?? null),
    ...parseJsonStringArray(parsedResume?.certifications),
    ...parseJsonStringArray((candidate.metadata as { certifications?: unknown } | null)?.certifications),
  ]);

  return {
    candidateSkills,
    candidateTitles,
    resumeBullets,
    parsedEducation,
    parsedCertifications,
  };
}

function evaluateSkills(
  skills: string[],
  resumeText: string,
  candidateSkills: string[],
  maxScore: number,
  tier: "critical" | "core" | "preferred",
  emptyReason: string,
  overlappingKeywords: string[] = []
): { section: SectionScoreDetail; evaluations: SkillEvaluation[]; transferable: TransferableSkillEntry[] } {
  if (skills.length === 0) {
    return {
      section: inactiveSection(emptyReason),
      evaluations: [],
      transferable: [],
    };
  }

  const evaluations: SkillEvaluation[] = skills.map((skill) => {
    const match = classifySkillMatch(resumeText, skill, candidateSkills);
    let status = match.status;
    let evidenceText = match.evidence;
    let reasoning = match.reasoning;
    if (
      tier === "core" &&
      status === "Missing" &&
      overlappingKeywords.some((keyword) => {
        const skillNorm = normalizeText(skill);
        const keyNorm = normalizeText(keyword);
        return keyNorm.length >= 3 && (skillNorm.includes(keyNorm) || keyNorm.includes(skillNorm));
      })
    ) {
      status = "Transferable";
      evidenceText = overlappingKeywords.slice(0, 3).join(", ");
      reasoning = `No direct "${skill}" evidence, but related job/resume terms overlap (${evidenceText}).`;
    }
    const evidence = evidenceFromSkillStatus(status);
    return {
      skill,
      required: tier !== "preferred",
      found: status !== "Missing",
      yearsUsed: match.evidence === "Not Found" ? "Not Found" : undefined,
      evidence: evidenceText,
      reasoning,
      status,
      tier,
      evidenceLevel: evidence.level,
      evidenceKind: evidence.kind,
    };
  });

  const transferable = evaluations
    .filter((item) => item.status === "Transferable")
    .map((item) => ({
      required: item.skill,
      found: item.evidence,
      reasoning: item.reasoning,
    }));

  const pointsPerSkill = maxScore / skills.length;
  const score = evaluations.reduce(
    (sum, item) => sum + pointsPerSkill * evidenceScoreRatio(item.evidenceLevel ?? 0),
    0
  );

  const matched = evaluations.filter((item) => item.found).map((item) => item.skill);
  const missing = evaluations.filter((item) => !item.found).map((item) => item.skill);
  const label = tier === "critical" ? "Critical" : tier === "core" ? "Core" : "Preferred";

  return {
    section: {
      score: roundScore(score),
      maxScore,
      confidence: confidenceFromEvidence(matched[0] ?? "Not Found", ratioToSection(score, maxScore)),
      reasoning:
        missing.length === 0
          ? `All ${label.toLowerCase()} skills are supported by resume evidence.`
          : `${label} skill coverage is partial. Missing: ${missing.slice(0, 5).join(", ")}.`,
      matched,
      missing,
      details: { evaluations },
    },
    evaluations,
    transferable,
  };
}

function scorePreferredSkills(required: string[], resumeText: string, candidateSkills: string[]) {
  if (required.length === 0) {
    return inactiveSection("No preferred skills were listed in the job description.");
  }

  const coverage = keywordCoverage(required, resumeText, candidateSkills);
  const score = (coverage.coverage / 100) * SECTION_MAX.preferredSkills;
  return {
    score: roundScore(score),
    maxScore: SECTION_MAX.preferredSkills,
    confidence: confidenceFromEvidence(coverage.matched[0] ?? "Not Found", score / SECTION_MAX.preferredSkills),
    reasoning:
      coverage.missing.length === 0
        ? "Preferred skills are well represented in the resume."
        : `Preferred skill coverage is ${coverage.coverage}%. Missing preferred skills do not block the match.`,
    matched: coverage.matched,
    missing: coverage.missing,
  };
}

function scoreExperience(
  requiredYears: number | undefined,
  resumeText: string,
  candidate: Candidate,
  parsedResume?: RecruiterAnalyzeInput["parsedResume"]
) {
  const actualYears =
    resolveExperienceYearsForMatching(candidate, parsedResume ?? null) ??
    candidate.experienceYears ??
    candidate.yearsExperience ??
    estimateYearsFromResume(resumeText) ??
    null;

  if (!requiredYears) {
    return inactiveSection("No explicit experience requirement listed in the job description.");
  }

  if (actualYears == null) {
    return {
      score: 0,
      maxScore: SECTION_MAX.experience,
      confidence: "Low" as const,
      reasoning: `Job requires ${requiredYears} years, but years of experience were not found in the resume.`,
      matched: [],
      missing: [`${requiredYears} years experience`],
    };
  }

  const ratio = Math.min(actualYears / requiredYears, 1.25);
  const score = Math.min(ratio, 1) * SECTION_MAX.experience;
  return {
    score: roundScore(score),
    maxScore: SECTION_MAX.experience,
    confidence: confidenceFromEvidence(`${actualYears}`, ratio),
    reasoning:
      actualYears >= requiredYears
        ? `Candidate exceeds the minimum experience requirement (${actualYears} vs ${requiredYears} years).`
        : `Candidate is below the required experience (${actualYears} vs ${requiredYears} years).`,
    matched: [`${actualYears} years`],
    missing: actualYears >= requiredYears ? [] : [`${requiredYears - actualYears} additional years`],
  };
}

function scoreResponsibilities(responsibilities: string[], resumeBullets: string[], resumeText: string) {
  if (responsibilities.length === 0) {
    return {
      ...inactiveSection("No explicit responsibilities were extracted from the job description."),
      matchedItems: [] as string[],
      missingItems: [] as string[],
    };
  }

  const matchedItems: string[] = [];
  const missingItems: string[] = [];

  for (const responsibility of responsibilities.slice(0, 12)) {
    const normalized = normalizeText(responsibility);
    const bulletHit = resumeBullets.some((bullet) => {
      const normalizedBullet = normalizeText(bullet);
      return normalizedBullet.includes(normalized) || normalized.includes(normalizedBullet.slice(0, 24));
    });
    const patternHit = RESPONSIBILITY_EQUIVALENCES.some(
      (entry) => entry.requirement.test(responsibility) && entry.evidence.test(resumeText)
    );
    if (bulletHit || patternHit || resumeContainsTerm(resumeText, responsibility)) matchedItems.push(responsibility);
    else missingItems.push(responsibility);
  }

  const coverage = matchedItems.length / responsibilities.length;
  return {
    score: roundScore(coverage * SECTION_MAX.responsibilities),
    maxScore: SECTION_MAX.responsibilities,
    confidence: confidenceFromEvidence(matchedItems[0] ?? "Not Found", coverage),
    reasoning: `Responsibility coverage is ${Math.round(coverage * 100)}% based on resume bullets and semantic equivalents.`,
    matched: matchedItems,
    missing: missingItems,
    matchedItems,
    missingItems,
  };
}

function scoreIndustry(industry: string | undefined, jobText: string, resumeText: string) {
  const targetIndustry =
    industry ??
    INDUSTRY_KEYWORDS.find((keyword) => normalizeText(jobText).includes(keyword)) ??
    "";
  if (!targetIndustry) {
    return inactiveSection("No target industry was specified in the job description.");
  }

  const found = resumeContainsTerm(resumeText, targetIndustry);
  return {
    score: found ? SECTION_MAX.industry : 0,
    maxScore: SECTION_MAX.industry,
    confidence: found ? ("High" as const) : ("Low" as const),
    reasoning: found
      ? `Resume contains evidence of ${targetIndustry} industry experience.`
      : `No explicit ${targetIndustry} industry experience was found in the resume.`,
    matched: found ? [targetIndustry] : [],
    missing: found ? [] : [targetIndustry],
  };
}

function scoreEducation(requiredLevel: string | undefined, parsedEducation: Array<{ degree?: string; field?: string }>) {
  if (parsedEducation.length === 0) {
    return {
      score: 0,
      maxScore: SECTION_MAX.education,
      confidence: "Low" as const,
      reasoning: "No education information was found in the resume.",
      matched: [],
      missing: requiredLevel ? [requiredLevel] : ["Education details"],
    };
  }

  const degrees = parsedEducation
    .map((item) => [item.degree, item.field].filter(Boolean).join(" in "))
    .filter(Boolean);
  const meetsRequirement = requiredLevel
    ? degrees.some((degree) => normalizeText(degree).includes(normalizeText(requiredLevel)))
    : true;

  return {
    score: meetsRequirement ? SECTION_MAX.education : SECTION_MAX.education * 0.5,
    maxScore: SECTION_MAX.education,
    confidence: degrees.length ? ("Medium" as const) : ("Low" as const),
    reasoning: meetsRequirement
      ? `Education section supports the role (${degrees.join("; ")}).`
      : `Education was found, but it does not clearly satisfy ${requiredLevel ?? "the stated requirement"}.`,
    matched: degrees,
    missing: meetsRequirement ? [] : [requiredLevel ?? "Required education level"],
  };
}

function scoreCertifications(required: string[], resumeCerts: string[], resumeText: string) {
  if (required.length === 0) {
    return {
      score: resumeCerts.length ? SECTION_MAX.certifications : SECTION_MAX.certifications * 0.5,
      maxScore: SECTION_MAX.certifications,
      confidence: "Low" as const,
      reasoning: "No required certifications were listed in the job description.",
      matched: resumeCerts,
      missing: [],
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  for (const cert of required) {
    const found =
      resumeCerts.some((item) => termsMatchCert(item, cert)) || resumeContainsTerm(resumeText, cert);
    if (found) matched.push(cert);
    else missing.push(cert);
  }

  const score = (matched.length / required.length) * SECTION_MAX.certifications;
  return {
    score: roundScore(score),
    maxScore: SECTION_MAX.certifications,
    confidence: confidenceFromEvidence(matched[0] ?? "Not Found", matched.length / required.length),
    reasoning:
      missing.length === 0
        ? "All required certifications are present in the resume."
        : `Missing required certifications: ${missing.join(", ")}.`,
    matched,
    missing,
  };
}

function termsMatchCert(a: string, b: string) {
  return normalizeText(a).includes(normalizeText(b)) || normalizeText(b).includes(normalizeText(a));
}

function scoreTools(jobText: string, tools: string[], resumeText: string, candidateSkills: string[]) {
  const targetTools = uniqueSorted(
    tools.length > 0
      ? tools
      : COMMON_TOOLS.filter((tool) => normalizeText(jobText).includes(normalizeText(tool)))
  ).slice(0, 12);

  if (targetTools.length === 0) {
    return {
      score: SECTION_MAX.tools * 0.5,
      maxScore: SECTION_MAX.tools,
      confidence: "Low" as const,
      reasoning: "No tools or technologies were extracted from the job description.",
      matched: [],
      missing: [],
    };
  }

  const coverage = keywordCoverage(targetTools, resumeText, candidateSkills);
  const score = (coverage.matched.length / targetTools.length) * SECTION_MAX.tools;

  return {
    score: roundScore(score),
    maxScore: SECTION_MAX.tools,
    confidence: confidenceFromEvidence(coverage.matched[0] ?? "Not Found", score / SECTION_MAX.tools),
    reasoning: `Tools and technologies coverage is ${coverage.coverage}%.`,
    matched: coverage.matched,
    missing: coverage.missing,
  };
}

function scoreSoftSkills(resumeText: string) {
  const matched = SOFT_SKILL_EVIDENCE.filter((entry) => entry.pattern.test(resumeText)).map((entry) => entry.skill);
  const score = matched.length === 0 ? 0 : Math.min(matched.length / 4, 1) * SECTION_MAX.softSkills;
  return {
    score: roundScore(score),
    maxScore: SECTION_MAX.softSkills,
    confidence: matched.length >= 2 ? ("Medium" as const) : ("Low" as const),
    reasoning:
      matched.length > 0
        ? `Soft skills supported by resume evidence: ${matched.join(", ")}.`
        : "No explicit soft-skill evidence was found in the resume.",
    matched,
    missing: SOFT_SKILL_EVIDENCE.map((entry) => entry.skill).filter((skill) => !matched.includes(skill)),
  };
}

function scoreLocation(job: Job, candidate: Candidate, resumeText: string) {
  const evaluation = evaluateLocationMatch(job, candidate, resumeText);
  return {
    score: roundScore(SECTION_MAX.location * evaluation.scoreRatio),
    maxScore: SECTION_MAX.location,
    confidence: evaluation.confidence,
    reasoning: evaluation.reasoning,
    matched: evaluation.matched,
    missing: evaluation.missing,
  };
}

function buildDetailedReasoning(entries: Array<{ criterion: string; section: SectionScoreDetail }>): DetailedReasoningEntry[] {
  return entries.map(({ criterion, section }) => ({
    criterion,
    score: section.score,
    maxScore: section.maxScore,
    confidence: section.confidence,
    reasoning: section.reasoning,
    matched: section.matched ?? [],
    missing: section.missing ?? [],
  }));
}

function buildSummary(analysis: Omit<RecruiterMatchAnalysis, "summary">) {
  const strengths = analysis.strengths.slice(0, 3).join("; ") || "Limited documented strengths.";
  const risks =
    analysis.risks[0] === "No significant risks identified."
      ? "No major hiring risks were identified from available evidence."
      : analysis.risks.slice(0, 2).join("; ");
  const missing =
    analysis.criticalMissingRequirements.length > 0
      ? `Critical gaps include ${analysis.criticalMissingRequirements
          .slice(0, 3)
          .map((item) => item.requirement)
          .join(", ")}.`
      : "No critical mandatory gaps were identified.";

  return [
    `Overall match score: ${analysis.overallScore}/100 (${analysis.matchCategory}).`,
    `Recommendation: ${analysis.recommendation}.`,
    `Primary strengths: ${strengths}.`,
    `Key risks: ${risks}.`,
    missing,
    `Boolean coverage: ${analysis.atsKeywords.required.coverage}%. Location alignment: ${analysis.atsKeywords.preferred.coverage}%. Skills, tools, and responsibilities are not used.`,
  ].join(" ");
}

function authorizationClearlyFails(candidate: Candidate, resumeText: string) {
  const text = `${candidate.workAuthorization ?? ""} ${resumeText}`;
  return /\b(not authorized|unauthorized|no work authorization|ineligible to work)\b/i.test(text);
}

function evaluateCriticalRequirements(
  requirements: ReturnType<typeof parseJobRequirementTiers>,
  resumeText: string,
  candidate: Candidate,
  candidateSkills: string[],
  parsedCertifications: string[],
  experience: SectionScoreDetail
): { section: SectionScoreDetail; evaluations: SkillEvaluation[]; missing: CriticalMissingRequirement[] } {
  const items = requirements.critical;
  if (items.length === 0 && !requirements.experienceIsCritical) {
    return {
      section: inactiveSection("No critical must-have requirements were identified in the job description."),
      evaluations: [],
      missing: [],
    };
  }

  const evaluations: SkillEvaluation[] = [];
  const missing: CriticalMissingRequirement[] = [];

  for (const item of items) {
    if (item.kind === "authorization") {
      const fails = authorizationClearlyFails(candidate, resumeText);
      const level = fails ? 0 : 3;
      evaluations.push({
        skill: item.text,
        required: true,
        found: !fails,
        evidence: fails ? "Not Found" : (candidate.workAuthorization ?? "No disqualifying authorization evidence"),
        reasoning: fails
          ? "Resume or profile indicates the candidate is not authorized to work."
          : "No disqualifying work-authorization evidence was found.",
        status: fails ? "Missing" : "Exact Match",
        tier: "critical",
        evidenceLevel: level as 0 | 3,
        evidenceKind: fails ? "MISSING" : "EXACT",
      });
      if (fails) {
        missing.push({
          requirement: item.text,
          severity: "Critical",
          reasoning: "Work authorization appears to fail a mandatory requirement.",
        });
      }
      continue;
    }

    if (item.kind === "certification") {
      const found =
        parsedCertifications.some(
          (cert) =>
            normalizeText(cert).includes(normalizeText(item.text)) ||
            normalizeText(item.text).includes(normalizeText(cert))
        ) || resumeContainsTerm(resumeText, item.text);
      const status = found ? ("Exact Match" as const) : ("Missing" as const);
      const evidence = evidenceFromSkillStatus(status);
      evaluations.push({
        skill: item.text,
        required: true,
        found,
        evidence: found ? findEvidenceSnippet(resumeText, item.text) : "Not Found",
        reasoning: found
          ? `Required certification "${item.text}" is evidenced in the resume.`
          : `Required certification "${item.text}" was not found.`,
        status,
        tier: "critical",
        evidenceLevel: evidence.level,
        evidenceKind: evidence.kind,
      });
      if (!criticalEvidencePasses(evidence.level)) {
        missing.push({
          requirement: item.text,
          severity: "Critical",
          reasoning: `Mandatory certification "${item.text}" is missing.`,
        });
      }
      continue;
    }

    if (item.kind === "other") {
      const exactListed = candidateSkills.some((skill) => normalizeText(skill) === normalizeText(item.text));
      const found = exactListed || resumeContainsTerm(resumeText, item.text);
      const status = found ? ("Exact Match" as const) : ("Missing" as const);
      const evidence = evidenceFromSkillStatus(status);
      evaluations.push({
        skill: item.text,
        required: true,
        found,
        evidence: found ? findEvidenceSnippet(resumeText, item.text) : "Not Found",
        reasoning: found
          ? `Mandatory requirement "${item.text}" is evidenced in the resume.`
          : `Mandatory requirement "${item.text}" was not found.`,
        status,
        tier: "critical",
        evidenceLevel: evidence.level,
        evidenceKind: evidence.kind,
      });
      if (!criticalEvidencePasses(evidence.level)) {
        missing.push({
          requirement: item.text,
          severity: "Critical",
          reasoning: `Mandatory requirement "${item.text}" is missing.`,
        });
      }
      continue;
    }

    const match = classifySkillMatch(resumeText, item.text, candidateSkills);
    const evidence = evidenceFromSkillStatus(match.status);
    evaluations.push({
      skill: item.text,
      required: true,
      found: match.status !== "Missing",
      evidence: match.evidence,
      reasoning: match.reasoning,
      status: match.status,
      tier: "critical",
      evidenceLevel: evidence.level,
      evidenceKind: evidence.kind,
    });
    if (!criticalEvidencePasses(evidence.level)) {
      missing.push({
        requirement: item.text,
        severity: "Critical",
        reasoning: match.reasoning,
      });
    }
  }

  if (requirements.experienceIsCritical && requirements.experienceYears) {
    const actual = experience.matched?.[0];
    const hasYears = Boolean(actual) && experience.score > 0;
    if (!hasYears) {
      missing.push({
        requirement: `${requirements.experienceYears}+ years experience`,
        severity: "Critical",
        reasoning: experience.reasoning,
      });
    }
  }

  const scoredItems = evaluations.length;
  const maxScore = items.length > 0 ? SECTION_MAX.criticalRequirements : 0;
  const score =
    scoredItems === 0
      ? 0
      : evaluations.reduce(
          (sum, item) => sum + (maxScore / scoredItems) * evidenceScoreRatio(item.evidenceLevel ?? 0),
          0
        );

  return {
    section:
      maxScore === 0
        ? inactiveSection("No critical must-have requirements were identified in the job description.")
        : {
            score: roundScore(score),
            maxScore,
            confidence: missing.length === 0 ? "High" : "Low",
            reasoning:
              missing.length === 0
                ? "All critical must-have requirements are supported by demonstrated evidence."
                : `Missing critical requirements: ${missing.map((item) => item.requirement).join(", ")}.`,
            matched: evaluations.filter((item) => criticalEvidencePasses(item.evidenceLevel ?? 0)).map((item) => item.skill),
            missing: missing.map((item) => item.requirement),
            details: { evaluations },
          },
    evaluations,
    missing,
  };
}

function normalizedOverallScore(sections: SectionScoreDetail[]) {
  const possible = sections.reduce((sum, section) => sum + section.maxScore, 0);
  const earned = sections.reduce((sum, section) => sum + section.score, 0);
  if (possible <= 0) return 0;
  return roundScore((earned / possible) * 100);
}

function sectionPercent(section: SectionScoreDetail) {
  if (section.maxScore <= 0) return 0;
  return roundScore((section.score / section.maxScore) * 100);
}

export function analyzeResumeAgainstJob(input: RecruiterAnalyzeInput): RecruiterMatchAnalysis {
  const { job, candidate, parsedResume } = input;
  const resumeText = input.resumeText ?? candidate.summary ?? "";
  const booleanQuery = job.booleanSearch?.trim();
  let booleanAnalysis: RecruiterMatchAnalysis["booleanSearch"];

  if (booleanQuery) {
    const corpus = buildMatchingResumeCorpus(candidate, { resumeText, parsedResume });
    const booleanResult = runBooleanSearch(booleanQuery, corpus);
    if (!booleanResult.ok) {
      booleanAnalysis = {
        query: booleanQuery,
        passes: false,
        matchedTerms: [],
        reason: `Invalid job boolean search: ${booleanResult.error}`,
      };
    } else {
      booleanAnalysis = {
        query: booleanQuery,
        passes: booleanResult.passes,
        matchedTerms: booleanResult.matchedTerms,
        reason: booleanResult.passes ? undefined : "Does not match the job boolean search query.",
      };
    }
  }

  const unused = inactiveSection("Not used — matching considers Boolean search and location only.");
  const location = scoreLocation(job, candidate, resumeText);

  const booleanInvalid = Boolean(booleanAnalysis?.reason?.toLowerCase().includes("invalid"));
  const booleanActive = Boolean(booleanQuery && booleanAnalysis && !booleanInvalid);
  const booleanFails = booleanActive && booleanAnalysis?.passes !== true;
  const booleanSection: SectionScoreDetail = booleanActive
    ? {
        score: booleanAnalysis!.passes ? SECTION_MAX.booleanSearch : 0,
        maxScore: SECTION_MAX.booleanSearch,
        confidence: "High",
        reasoning: booleanAnalysis!.passes
          ? booleanAnalysis!.matchedTerms.length > 0
            ? `Matches the job Boolean search: ${booleanAnalysis!.matchedTerms.slice(0, 8).join(", ")}.`
            : "Matches the job Boolean search."
          : (booleanAnalysis!.reason ?? "Does not match the job Boolean search query."),
        matched: booleanAnalysis!.matchedTerms,
        missing: booleanAnalysis!.passes ? [] : ["Boolean search"],
      }
    : inactiveSection(
        booleanInvalid
          ? (booleanAnalysis?.reason ?? "Boolean search is invalid and was not used as a filter.")
          : "No Boolean search on this job.",
      );

  const notQualified = booleanFails;
  const overallScore = notQualified ? 0 : normalizedOverallScore([booleanSection, location]);
  const qualificationStatus = scoreToQualificationStatus(overallScore, notQualified);
  const matchCategory = notQualified ? ("Not Qualified" as const) : scoreToCategory(overallScore);
  const recommendation = notQualified ? ("Reject" as const) : scoreToRecommendation(overallScore);

  const requirementBreakdown = {
    critical: unused,
    coreSkills: unused,
    preferredSkills: unused,
    responsibilities: unused,
    experience: unused,
    jobTitle: unused,
    industry: unused,
    location,
    booleanSearch: booleanSection,
  };

  const sectionScores = {
    jobTitle: unused,
    requiredSkills: unused,
    preferredSkills: unused,
    experience: unused,
    responsibilities: unused,
    industry: unused,
    education: unused,
    certifications: unused,
    tools: unused,
    softSkills: unused,
    location,
    criticalRequirements: unused,
  };

  const strengths: string[] = [];
  if (booleanSection.maxScore > 0 && booleanSection.score >= booleanSection.maxScore) {
    strengths.push("Matches the job Boolean search");
  }
  if (location.maxScore > 0 && location.score >= location.maxScore * 0.75) {
    strengths.push("Location aligns with the job");
  }

  const risks: string[] = [];
  if (booleanFails) {
    risks.push("Does not match the job Boolean search.");
  }
  if (location.maxScore > 0 && location.score < location.maxScore * 0.6) {
    risks.push(location.reasoning);
  }
  if (risks.length === 0) risks.push("No significant risks identified.");

  const detailedReasoning = buildDetailedReasoning([
    { criterion: "Boolean Search", section: booleanSection },
    { criterion: "Location", section: location },
  ]);

  const baseAnalysis = {
    overallScore,
    matchCategory,
    recommendation,
    confidence: notQualified
      ? ("High" as const)
      : confidenceFromEvidence(location.matched?.[0] ?? booleanSection.matched?.[0] ?? "Not Found", overallScore / 100),
    engineVersion: "v2" as const,
    qualificationStatus,
    sectionScores,
    requirementBreakdown,
    strengths: uniqueSorted(strengths),
    risks,
    criticalMissingRequirements: [],
    atsKeywords: {
      required: {
        matched: booleanSection.matched ?? [],
        missing: booleanSection.missing ?? [],
        coverage: booleanSection.maxScore > 0 ? roundScore((booleanSection.score / booleanSection.maxScore) * 100) : 0,
      },
      preferred: { matched: location.matched ?? [], missing: location.missing ?? [], coverage: sectionPercent(location) },
    },
    transferableSkills: [],
    matchedResponsibilities: [],
    missingResponsibilities: [],
    skillEvaluations: [],
    detailedReasoning,
    overlappingKeywords: [],
  };

  const analysis: RecruiterMatchAnalysis = {
    ...baseAnalysis,
    summary: buildSummary(baseAnalysis),
  };

  if (booleanAnalysis) {
    return attachBooleanSearch(analysis, booleanAnalysis);
  }

  return analysis;
}

export function analysisToLegacyMatchResult(analysis: RecruiterMatchAnalysis) {
  const booleanSection = analysis.requirementBreakdown?.booleanSearch;
  const booleanPercent =
    booleanSection && booleanSection.maxScore > 0
      ? sectionPercent(booleanSection)
      : analysis.booleanSearch?.passes
        ? 100
        : 0;
  return {
    score: analysis.overallScore,
    skillsMatch: booleanPercent,
    experienceMatch: 0,
    descriptionMatch: sectionPercent(analysis.sectionScores.location),
    missingSkills: analysis.sectionScores.location.missing ?? [],
    matchedKeywords: [
      ...(analysis.booleanSearch?.matchedTerms ?? []),
      ...(analysis.sectionScores.location.matched ?? []),
    ],
    reason: analysis.summary.slice(0, 500),
    analysis,
  };
}
