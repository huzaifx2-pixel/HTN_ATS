import type { ParsedField } from "@/lib/parsers/pipeline/parsed-field";

export const JOB_PARSER_VERSION = "1.0.0";

export type JobFieldSource = "api" | "html" | "csv" | "manual" | "inferred";

export interface JobDocumentMeta {
  source: JobFieldSource;
  externalId?: string;
  wordCount: number;
  language: string;
  parsedAt: string;
  parserVersion: string;
  sectionsFound: string[];
}

export interface JobQualityScores {
  completeness: number;
  skillCoverage: number;
  sectionCompleteness: number;
  overall: number;
  missingSections: string[];
}

export interface JobSkillEntry {
  skill: ParsedField<string>;
  category: string;
  required: boolean;
  preferred: boolean;
  explicit: boolean;
}

export interface JobExperienceRequirement {
  minYears?: ParsedField<number>;
  maxYears?: ParsedField<number>;
  seniority?: ParsedField<string>;
}

export interface JobCompensation {
  salaryMin?: ParsedField<number>;
  salaryMax?: ParsedField<number>;
  currency?: ParsedField<string>;
  period?: ParsedField<string>;
}

export interface JobLocationInfo {
  raw?: ParsedField<string>;
  city?: ParsedField<string>;
  country?: ParsedField<string>;
  remote?: ParsedField<boolean>;
  workplaceType?: ParsedField<string>;
}

export interface JobSections {
  summary?: ParsedField<string>;
  responsibilities: string[];
  requirements: string[];
  preferredQualifications: string[];
  benefits: string[];
  certifications: string[];
}

export interface JobParseInsights {
  primaryCategory?: string;
  topSkills: string[];
  requiredSkillCount: number;
  preferredSkillCount: number;
  estimatedSeniority?: string;
}

export interface StructuredJobParseResult {
  parserVersion: string;
  document: JobDocumentMeta;
  quality: JobQualityScores;
  title: ParsedField<string>;
  sections: JobSections;
  skills: JobSkillEntry[];
  experience: JobExperienceRequirement;
  compensation: JobCompensation;
  location: JobLocationInfo;
  employmentType?: ParsedField<string>;
  insights: JobParseInsights;
  rawText: string;
  source: JobFieldSource;
}

export interface JobPipelineInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
  preferredQualifications?: string | null;
  benefits?: string | null;
  summary?: string | null;
  location?: string | null;
  country?: string | null;
  city?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  remote?: boolean | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  hintSkills?: string[];
  hintPreferredSkills?: string[];
  source?: JobFieldSource;
  externalId?: string;
}
