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
    matchCategory: "Poor Match",
    recommendation: "Reject",
    confidence: "High",
    summary: booleanSearch.reason ?? "Does not match the job boolean search query.",
    sectionScores: {
      jobTitle: emptySection(10),
      requiredSkills: emptySection(30),
      preferredSkills: emptySection(10),
      experience: emptySection(10),
      responsibilities: emptySection(15),
      industry: emptySection(5),
      education: emptySection(5),
      certifications: emptySection(5),
      tools: emptySection(5),
      softSkills: emptySection(3),
      location: emptySection(2),
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
