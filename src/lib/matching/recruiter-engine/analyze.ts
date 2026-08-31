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
  parseCommaList,
  parseJsonStringArray,
  resumeContainsTerm,
  roundScore,
  scoreToCategory,
  scoreToRecommendation,
  titleAlignmentScore,
  uniqueSorted,
} from "@/lib/matching/recruiter-engine/text-utils";
import { parseSkills } from "@/lib/utils";
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
import {
  attachBooleanSearch,
  buildBooleanFailureAnalysis,
} from "@/lib/matching/boolean-search/analysis";

const SECTION_MAX = {
  jobTitle: 10,
  requiredSkills: 30,
  preferredSkills: 10,
  experience: 10,
  responsibilities: 15,
  industry: 5,
  education: 5,
  certifications: 5,
  tools: 5,
  softSkills: 3,
  location: 2,
} as const;

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

type JobRequirements = {
  skills?: string[];
  preferredSkills?: string[];
  certifications?: string[];
  experienceYears?: number;
  educationLevel?: string;
  industry?: string;
  tools?: string[];
  responsibilities?: string[];
};

function parseRequirements(job: Job): JobRequirements {
  const req = (job.requirements ?? {}) as JobRequirements;
  return {
    skills: uniqueSorted([
      ...parseJsonStringArray(req.skills),
      ...parseCommaList(job.requirementsText),
    ]),
    preferredSkills: uniqueSorted([
      ...parseJsonStringArray(req.preferredSkills),
      ...parseCommaList(job.preferredQualifications),
    ]),
    certifications: parseJsonStringArray(req.certifications),
    experienceYears: req.experienceYears ?? job.experienceMin ?? undefined,
    educationLevel: req.educationLevel,
    industry: req.industry,
    tools: parseJsonStringArray(req.tools),
    responsibilities: uniqueSorted([
      ...parseJsonStringArray(req.responsibilities),
      ...extractBulletLines(job.responsibilities ?? ""),
      ...extractBulletLines(job.description ?? "").slice(0, 8),
    ]),
  };
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

function scoreRequiredSkills(
  requiredSkills: string[],
  resumeText: string,
  candidateSkills: string[]
): { section: SectionScoreDetail; evaluations: SkillEvaluation[]; transferable: TransferableSkillEntry[] } {
  if (requiredSkills.length === 0) {
    return {
      section: {
        score: SECTION_MAX.requiredSkills,
        maxScore: SECTION_MAX.requiredSkills,
        confidence: "Low",
        reasoning: "No required skills were listed in the job description.",
        matched: [],
        missing: [],
      },
      evaluations: [],
      transferable: [],
    };
  }

  const evaluations: SkillEvaluation[] = requiredSkills.map((skill) => {
    const match = classifySkillMatch(resumeText, skill, candidateSkills);
    return {
      skill,
      required: true,
      found: match.status !== "Missing",
      yearsUsed: match.evidence === "Not Found" ? "Not Found" : undefined,
      evidence: match.evidence,
      reasoning: match.reasoning,
      status: match.status,
    };
  });

  const transferable = evaluations
    .filter((item) => item.status === "Transferable")
    .map((item) => ({
      required: item.skill,
      found: item.evidence,
      reasoning: item.reasoning,
    }));

  const pointsPerSkill = SECTION_MAX.requiredSkills / requiredSkills.length;
  const score = evaluations.reduce((sum, item) => {
    if (item.status === "Exact Match" || item.status === "Equivalent Match") return sum + pointsPerSkill;
    if (item.status === "Semantic Match") return sum + pointsPerSkill * 0.85;
    if (item.status === "Transferable") return sum + pointsPerSkill * 0.6;
    return sum;
  }, 0);

  const matched = evaluations.filter((item) => item.found).map((item) => item.skill);
  const missing = evaluations.filter((item) => !item.found).map((item) => item.skill);

  return {
    section: {
      score: roundScore(score),
      maxScore: SECTION_MAX.requiredSkills,
      confidence: confidenceFromEvidence(matched.length ? matched[0] : "Not Found", score / SECTION_MAX.requiredSkills),
      reasoning:
        missing.length === 0
          ? "All required skills are supported by explicit or semantic resume evidence."
          : `Required skill coverage is partial. Missing: ${missing.slice(0, 5).join(", ")}.`,
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
    return {
      score: SECTION_MAX.preferredSkills,
      maxScore: SECTION_MAX.preferredSkills,
      confidence: "Low" as const,
      reasoning: "No preferred skills were listed in the job description.",
      matched: [] as string[],
      missing: [] as string[],
    };
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
    return {
      score: actualYears ? SECTION_MAX.experience * 0.7 : SECTION_MAX.experience * 0.4,
      maxScore: SECTION_MAX.experience,
      confidence: "Low" as const,
      reasoning: actualYears
        ? `No explicit experience requirement listed. Candidate shows ${actualYears} years of experience.`
        : "No explicit experience requirement or years of experience evidence was found.",
      matched: actualYears ? [`${actualYears} years`] : [],
      missing: [] as string[],
    };
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
      score: SECTION_MAX.responsibilities * 0.5,
      maxScore: SECTION_MAX.responsibilities,
      confidence: "Low" as const,
      reasoning: "No explicit responsibilities were extracted from the job description.",
      matched: [] as string[],
      missing: [] as string[],
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
    return {
      score: SECTION_MAX.industry * 0.5,
      maxScore: SECTION_MAX.industry,
      confidence: "Low" as const,
      reasoning: "No target industry was specified in the job description.",
      matched: [],
      missing: [],
    };
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
    `Required skill coverage: ${analysis.atsKeywords.required.coverage}%. Responsibility alignment and experience were evaluated using evidence-only recruiter rules without inferred qualifications.`,
  ].join(" ");
}

export function analyzeResumeAgainstJob(input: RecruiterAnalyzeInput): RecruiterMatchAnalysis {
  const { job, candidate, parsedResume } = input;
  const resumeText = input.resumeText ?? candidate.summary ?? "";
  const booleanQuery = job.booleanSearch?.trim();
  let booleanPass: { query: string; matchedTerms: string[] } | null = null;

  if (booleanQuery) {
    const corpus = buildMatchingResumeCorpus(candidate, { resumeText, parsedResume });
    const booleanResult = runBooleanSearch(booleanQuery, corpus);

    if (!booleanResult.ok) {
      return buildBooleanFailureAnalysis({
        query: booleanQuery,
        passes: false,
        matchedTerms: [],
        reason: `Invalid job boolean search: ${booleanResult.error}`,
      });
    } else if (!booleanResult.passes) {
      return buildBooleanFailureAnalysis({
        query: booleanQuery,
        passes: false,
        matchedTerms: booleanResult.matchedTerms,
        reason: "Does not match the job boolean search query.",
      });
    } else {
      booleanPass = { query: booleanQuery, matchedTerms: booleanResult.matchedTerms };
    }
  }

  const requirements = parseRequirements(job);
  const corpus = buildResumeCorpus(candidate, resumeText, parsedResume);
  const jobText = [job.title, job.description, job.responsibilities, job.requirementsText]
    .filter(Boolean)
    .join("\n");

  const titleEval = titleAlignmentScore(job.title, corpus.candidateTitles);
  const jobTitle: SectionScoreDetail = {
    score: roundScore(titleEval.score * SECTION_MAX.jobTitle),
    maxScore: SECTION_MAX.jobTitle,
    confidence: confidenceFromEvidence(titleEval.matched[0] ?? "Not Found", titleEval.score),
    reasoning: titleEval.reasoning,
    matched: titleEval.matched,
    missing: titleEval.matched.length ? [] : [job.title],
  };

  const required = scoreRequiredSkills(requirements.skills ?? [], resumeText, corpus.candidateSkills);
  const preferredSkills = scorePreferredSkills(requirements.preferredSkills ?? [], resumeText, corpus.candidateSkills);
  const experience = scoreExperience(requirements.experienceYears, resumeText, candidate, parsedResume);
  const responsibilities = scoreResponsibilities(requirements.responsibilities ?? [], corpus.resumeBullets, resumeText);
  const industry = scoreIndustry(requirements.industry, jobText, resumeText);
  const education = scoreEducation(requirements.educationLevel, corpus.parsedEducation);
  const certifications = scoreCertifications(
    requirements.certifications ?? [],
    corpus.parsedCertifications,
    resumeText
  );
  const tools = scoreTools(jobText, requirements.tools ?? [], resumeText, corpus.candidateSkills);
  const softSkills = scoreSoftSkills(resumeText);
  const location = scoreLocation(job, candidate, resumeText);

  const sectionScores = {
    jobTitle,
    requiredSkills: required.section,
    preferredSkills,
    experience,
    responsibilities,
    industry,
    education,
    certifications,
    tools,
    softSkills,
    location,
  };

  const overallScore = roundScore(
    Object.values(sectionScores).reduce((sum, section) => sum + section.score, 0)
  );

  const atsRequired = keywordCoverage(requirements.skills ?? [], resumeText, corpus.candidateSkills);
  const atsPreferred = keywordCoverage(requirements.preferredSkills ?? [], resumeText, corpus.candidateSkills);

  const criticalMissingRequirements: CriticalMissingRequirement[] = required.evaluations
    .filter((item) => item.status === "Missing")
    .map((item) => ({
      requirement: item.skill,
      severity: "Critical" as const,
      reasoning: item.reasoning,
    }));

  const strengths: string[] = [];
  if (experience.score >= SECTION_MAX.experience * 0.9) strengths.push("Meets or exceeds experience requirement");
  if (required.section.score >= SECTION_MAX.requiredSkills * 0.75) strengths.push("Strong required technical stack alignment");
  if (industry.score >= SECTION_MAX.industry) strengths.push("Relevant industry background");
  if (softSkills.matched.includes("Leadership") || softSkills.matched.includes("Mentoring")) {
    strengths.push("Leadership or mentoring experience evidenced in resume");
  }
  if (responsibilities.score >= SECTION_MAX.responsibilities * 0.7) strengths.push("High responsibility alignment");
  if (education.score >= SECTION_MAX.education * 0.8) strengths.push("Education supports role requirements");
  if (tools.score >= SECTION_MAX.tools * 0.7) strengths.push("Strong tools and technologies coverage");

  const risks: string[] = [];
  if (criticalMissingRequirements.length > 0) {
    risks.push(`Missing required skills: ${criticalMissingRequirements.slice(0, 3).map((item) => item.requirement).join(", ")}`);
  }
  if (certifications.missing.length > 0) risks.push(`Missing certifications: ${certifications.missing.join(", ")}`);
  if (experience.score < SECTION_MAX.experience * 0.5 && requirements.experienceYears) {
    risks.push("Experience below stated requirement");
  }
  if (industry.score === 0 && requirements.industry) risks.push("Different or unverified industry background");
  if (location.score < SECTION_MAX.location * 0.5 && (job.location || job.country)) {
    risks.push("Location or work authorization may not match the role");
  }
  if (risks.length === 0) risks.push("No significant risks identified.");

  const detailedReasoning = buildDetailedReasoning([
    { criterion: "Job Title Alignment", section: jobTitle },
    { criterion: "Required Technical Skills", section: required.section },
    { criterion: "Preferred Skills", section: preferredSkills },
    { criterion: "Years of Experience", section: experience },
    { criterion: "Responsibilities Alignment", section: responsibilities },
    { criterion: "Industry Experience", section: industry },
    { criterion: "Education", section: education },
    { criterion: "Certifications", section: certifications },
    { criterion: "Tools & Technologies", section: tools },
    { criterion: "Soft Skills", section: softSkills },
    { criterion: "Location / Work Authorization", section: location },
  ]);

  const baseAnalysis = {
    overallScore,
    matchCategory: scoreToCategory(overallScore),
    recommendation: scoreToRecommendation(overallScore),
    confidence: confidenceFromEvidence(
      required.section.matched?.[0] ?? "Not Found",
      overallScore / 100
    ),
    sectionScores,
    strengths: uniqueSorted(strengths),
    risks,
    criticalMissingRequirements,
    atsKeywords: {
      required: atsRequired,
      preferred: atsPreferred,
    },
    transferableSkills: required.transferable,
    matchedResponsibilities: responsibilities.matchedItems ?? responsibilities.matched ?? [],
    missingResponsibilities: responsibilities.missingItems ?? responsibilities.missing ?? [],
    skillEvaluations: required.evaluations,
    detailedReasoning,
  };

  const analysis: RecruiterMatchAnalysis = {
    ...baseAnalysis,
    summary: buildSummary(baseAnalysis),
  };

  if (booleanPass) {
    return attachBooleanSearch(analysis, {
      query: booleanPass.query,
      passes: true,
      matchedTerms: booleanPass.matchedTerms,
    });
  }

  return analysis;
}

export function analysisToLegacyMatchResult(analysis: RecruiterMatchAnalysis) {
  return {
    score: analysis.overallScore,
    skillsMatch: roundScore((analysis.sectionScores.requiredSkills.score / SECTION_MAX.requiredSkills) * 100),
    experienceMatch: roundScore((analysis.sectionScores.experience.score / SECTION_MAX.experience) * 100),
    descriptionMatch: roundScore((analysis.sectionScores.responsibilities.score / SECTION_MAX.responsibilities) * 100),
    missingSkills: analysis.atsKeywords.required.missing,
    matchedKeywords: analysis.atsKeywords.required.matched,
    reason: analysis.summary.slice(0, 500),
    analysis,
  };
}
