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
  | "Good Match"
  | "Potential Match"
  | "Moderate Match"
  | "Adjacent Match"
  | "Weak Match"
  | "Poor Match"
  | "Not Qualified";

export type HiringRecommendation =
  | "Highly Recommended"
  | "Recommended"
  | "Consider"
  | "Not Recommended"
  | "Reject";

export type QualificationStatus = "EXCELLENT" | "STRONG" | "POTENTIAL" | "NOT_QUALIFIED";

export type RequirementTier = "critical" | "core" | "preferred";

export type EvidenceKind = "EXACT" | "EQUIVALENT" | "RELATED" | "MISSING";

export type EvidenceLevel = 0 | 1 | 2 | 3;

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
  tier?: RequirementTier;
  evidenceLevel?: EvidenceLevel;
  evidenceKind?: EvidenceKind;
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

export interface RequirementBreakdown {
  critical: SectionScoreDetail;
  coreSkills: SectionScoreDetail;
  preferredSkills: SectionScoreDetail;
  responsibilities: SectionScoreDetail;
  experience: SectionScoreDetail;
  jobTitle: SectionScoreDetail;
  industry: SectionScoreDetail;
  location: SectionScoreDetail;
  booleanSearch: SectionScoreDetail;
}

export interface RecruiterMatchAnalysis {
  overallScore: number;
  matchCategory: MatchCategory;
  recommendation: HiringRecommendation;
  confidence: MatchConfidence;
  summary: string;
  engineVersion?: "v2";
  qualificationStatus?: QualificationStatus;

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
    criticalRequirements: SectionScoreDetail;
  };

  requirementBreakdown?: RequirementBreakdown;

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
  overlappingKeywords?: string[];
  retrievalSignals?: {
    boolean: boolean;
    title: boolean;
    skills: boolean;
    semantic: boolean;
    location: boolean;
  };
  retrievalScore?: number;
  semanticSimilarity?: number;
}
