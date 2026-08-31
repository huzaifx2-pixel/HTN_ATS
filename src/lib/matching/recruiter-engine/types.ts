export type MatchConfidence = "High" | "Medium" | "Low";

export type SkillMatchStatus =
  | "Exact Match"
  | "Equivalent Match"
  | "Semantic Match"
  | "Transferable"
  | "Missing";

export type MatchCategory =
  | "Excellent Match"
  | "Strong Match"
  | "Moderate Match"
  | "Weak Match"
  | "Poor Match";

export type HiringRecommendation =
  | "Highly Recommended"
  | "Recommended"
  | "Consider"
  | "Not Recommended"
  | "Reject";

export type MissingRequirementSeverity = "Critical" | "Important" | "Preferred";

export interface SectionScoreDetail {
  score: number;
  maxScore: number;
  confidence: MatchConfidence;
  reasoning: string;
  matched?: string[];
  missing?: string[];
  details?: Record<string, unknown>;
}

export interface SkillEvaluation {
  skill: string;
  required: boolean;
  found: boolean;
  yearsUsed?: number | "Not Found";
  evidence: string;
  reasoning: string;
  status: SkillMatchStatus;
}

export interface DetailedReasoningEntry {
  criterion: string;
  score: number;
  maxScore: number;
  confidence: MatchConfidence;
  reasoning: string;
  matched: string[];
  missing: string[];
}

export interface CriticalMissingRequirement {
  requirement: string;
  severity: MissingRequirementSeverity;
  reasoning: string;
}

export interface TransferableSkillEntry {
  required: string;
  found: string;
  reasoning: string;
}

export interface RecruiterMatchAnalysis {
  overallScore: number;
  matchCategory: MatchCategory;
  recommendation: HiringRecommendation;
  confidence: MatchConfidence;
  summary: string;

  sectionScores: {
    jobTitle: SectionScoreDetail;
    requiredSkills: SectionScoreDetail;
    preferredSkills: SectionScoreDetail;
    experience: SectionScoreDetail;
    responsibilities: SectionScoreDetail;
    industry: SectionScoreDetail;
    education: SectionScoreDetail;
    certifications: SectionScoreDetail;
    tools: SectionScoreDetail;
    softSkills: SectionScoreDetail;
    location: SectionScoreDetail;
  };

  strengths: string[];
  risks: string[];
  criticalMissingRequirements: CriticalMissingRequirement[];

  atsKeywords: {
    required: { matched: string[]; missing: string[]; coverage: number };
    preferred: { matched: string[]; missing: string[]; coverage: number };
  };

  transferableSkills: TransferableSkillEntry[];
  matchedResponsibilities: string[];
  missingResponsibilities: string[];
  skillEvaluations: SkillEvaluation[];

  detailedReasoning: DetailedReasoningEntry[];
  booleanSearch?: {
    query: string;
    passes: boolean;
    matchedTerms: string[];
    reason?: string;
  };
}
