import type { RecruiterMatchAnalysis } from "@/lib/matching/recruiter-engine/types";
import type { BooleanSearchAnalysis } from "@/lib/matching/boolean-search";

const EMPTY_SECTION = {
  score: 0,
  maxScore: 0,
  confidence: "Low" as const,
  reasoning: "Not evaluated — candidate failed boolean search filter.",
  matched: [] as string[],
  missing: [] as string[],
};

function emptySection(maxScore: number) {
  return { ...EMPTY_SECTION, maxScore };
}

export function buildBooleanFailureAnalysis(
  booleanSearch: BooleanSearchAnalysis
): RecruiterMatchAnalysis {
  return {
    overallScore: 0,
    matchCategory: "Not Qualified",
    recommendation: "Reject",
    confidence: "High",
    engineVersion: "v2",
    qualificationStatus: "NOT_QUALIFIED",
    summary: booleanSearch.reason ?? "Does not match the job boolean search query.",
    sectionScores: {
      jobTitle: emptySection(0),
      requiredSkills: emptySection(0),
      preferredSkills: emptySection(0),
      experience: emptySection(0),
      responsibilities: emptySection(0),
      industry: emptySection(0),
      education: emptySection(0),
      certifications: emptySection(0),
      tools: emptySection(0),
      softSkills: emptySection(0),
      location: emptySection(50),
      criticalRequirements: emptySection(0),
    },
    strengths: [],
    risks: ["Candidate does not satisfy the job boolean search filter."],
    criticalMissingRequirements: [],
    atsKeywords: {
      required: { matched: [], missing: [], coverage: 0 },
      preferred: { matched: [], missing: [], coverage: 0 },
    },
    transferableSkills: [],
    matchedResponsibilities: [],
    missingResponsibilities: [],
    skillEvaluations: [],
    detailedReasoning: [],
    booleanSearch,
  };
}

export function attachBooleanSearch(
  analysis: RecruiterMatchAnalysis,
  booleanSearch: BooleanSearchAnalysis
): RecruiterMatchAnalysis {
  return { ...analysis, booleanSearch };
}
