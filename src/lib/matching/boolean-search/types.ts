export type JobRequirements = {
  skills?: string[];
  preferredSkills?: string[];
};

export type BooleanSearchAnalysis = {
  query: string;
  passes: boolean;
  matchedTerms: string[];
  reason?: string;
};

export type EntityKind = "hard_skill" | "technology" | "platform" | "tool" | "certification";

