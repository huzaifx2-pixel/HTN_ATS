import type { MatchConfidence, QualificationStatus, RecruiterMatchAnalysis, RequirementBreakdown, SectionScoreDetail } from "@/lib/matching/recruiter-engine/types";

export type CompactSection = {
  score: number;
  maxScore: number;
  matched: string[];
  missing: string[];
};

export type CompactRequirementBreakdown = {
  critical: CompactSection;
  coreSkills: CompactSection;
  preferredSkills: CompactSection;
  responsibilities: CompactSection;
  experience: CompactSection;
  jobTitle: CompactSection;
  industry: CompactSection;
  location: CompactSection;
  booleanSearch: CompactSection;
};

function compactSection(section: SectionScoreDetail | undefined): CompactSection {
  return {
    score: section?.score ?? 0,
    maxScore: section?.maxScore ?? 0,
    matched: (section?.matched ?? []).slice(0, 8),
    missing: (section?.missing ?? []).slice(0, 8),
  };
}

export function compactRequirementBreakdown(
  breakdown: RequirementBreakdown | undefined
): CompactRequirementBreakdown | null {
  if (!breakdown) return null;
  return {
    critical: compactSection(breakdown.critical),
    coreSkills: compactSection(breakdown.coreSkills),
    preferredSkills: compactSection(breakdown.preferredSkills),
    responsibilities: compactSection(breakdown.responsibilities),
    experience: compactSection(breakdown.experience),
    jobTitle: compactSection(breakdown.jobTitle),
    industry: compactSection(breakdown.industry),
    location: compactSection(breakdown.location),
    booleanSearch: compactSection(breakdown.booleanSearch),
  };
}

export function persistableMatchStatus(
  status: QualificationStatus | undefined
): "EXCELLENT" | "STRONG" | "POTENTIAL" | null {
  if (status === "EXCELLENT" || status === "STRONG" || status === "POTENTIAL") return status;
  return null;
}

export function persistableConfidence(confidence: MatchConfidence | undefined): MatchConfidence | null {
  if (confidence === "High" || confidence === "Medium" || confidence === "Low") return confidence;
  return null;
}

export function analysisPersistFields(analysis: RecruiterMatchAnalysis) {
  return {
    matchStatus: persistableMatchStatus(analysis.qualificationStatus),
    confidence: persistableConfidence(analysis.confidence),
    requirementBreakdown: compactRequirementBreakdown(analysis.requirementBreakdown),
  };
}

const MATCH_PERSIST_THRESHOLD = 60;
const LOCATION_PERSIST_RATIO = 0.6;

export function matchPersistThreshold() {
  return MATCH_PERSIST_THRESHOLD;
}

/**
 * Boolean and location are the only membership filters for the match list.
 * Skills, tools, and responsibilities are not used.
 */
export function isPersistableMatch(
  score: number,
  analysis?: {
    booleanSearch?: RecruiterMatchAnalysis["booleanSearch"];
    sectionScores?: { location?: { score: number; maxScore: number } };
  }
) {
  if (score < MATCH_PERSIST_THRESHOLD) return false;
  const booleanSearch = analysis?.booleanSearch;
  if (booleanSearch?.query?.trim() && !booleanSearch.reason?.toLowerCase().includes("invalid")) {
    if (booleanSearch.passes !== true) return false;
  }
  const location = analysis?.sectionScores?.location;
  if (location && location.maxScore > 0 && location.score / location.maxScore < LOCATION_PERSIST_RATIO) {
    return false;
  }
  return true;
}
