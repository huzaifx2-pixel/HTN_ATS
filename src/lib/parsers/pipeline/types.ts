import type { ParsedContactInfo } from "@/lib/parsers/contact-types";
import type { ParsedField, FieldSource, ExtractionMethod } from "./parsed-field";

export const PARSER_PIPELINE_VERSION = "3.0.0";
export const TAXONOMY_VERSION = "1.0.0";

export interface DocumentMeta {
  fileType: string;
  fileName?: string;
  wordCount: number;
  pageEstimate: number;
  language: string;
  ocrUsed: boolean;
  ocrConfidence?: number;
  uploadedAt: string;
  lastParsedAt: string;
  parserVersion: string;
  taxonomyVersion?: string;
  fingerprint?: string;
  extractionMethod?: ExtractionMethod;
}

export interface ResumeQualityScores {
  formatting: number;
  readability: number;
  contactCompleteness: number;
  sectionCompleteness: number;
  keywordDensity: number;
  overall: number;
  missingSections: string[];
}

export interface ParsedSkillEntry {
  skill: ParsedField<string>;
  category: string;
  yearsUsed?: number;
  lastUsed?: string;
  explicit: boolean;
}

export interface ParsedEmployment {
  company: ParsedField<string>;
  jobTitle: ParsedField<string>;
  location?: ParsedField<string>;
  employmentType?: string;
  startDate?: ParsedField<string>;
  endDate?: ParsedField<string>;
  isCurrent: boolean;
  durationMonths?: number;
  responsibilities: string[];
  achievements: string[];
  technologies: string[];
  description?: string;
}

export interface ParsedEducationEntry {
  institution: ParsedField<string>;
  degree?: ParsedField<string>;
  field?: ParsedField<string>;
  startDate?: string;
  endDate?: string;
  graduationDate?: string;
  country?: string;
  honors?: string;
}

export interface ParsedCertification {
  name: ParsedField<string>;
  issuer?: ParsedField<string>;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  status: "active" | "expired" | "unknown";
}

export interface ParsedProject {
  name: ParsedField<string>;
  role?: string;
  description?: string;
  technologies: string[];
  duration?: string;
}

export interface ParsedAward {
  name: ParsedField<string>;
  issuer?: string;
  year?: string;
}

export interface ParsedPublication {
  title: ParsedField<string>;
  venue?: string;
  year?: string;
}

export interface ExperienceMetrics {
  totalYears: number;
  relevantYears: number;
  leadershipYears: number;
  managementYears: number;
  companyCount: number;
  averageTenureMonths: number;
  jobHopperRisk: "low" | "medium" | "high";
  gapCount: number;
}

export interface ParseInsights {
  currentSeniority?: string;
  careerLevel?: string;
  primaryProfession?: string;
  topSkills: string[];
  skillDensity: number;
  resumeCompleteness: number;
  promotionTrend?: "upward" | "lateral" | "mixed" | "unknown";
}

export interface StructuredParseResult {
  parserVersion: string;
  taxonomyVersion?: string;
  document: DocumentMeta;
  quality: ResumeQualityScores;
  contact: ParsedContactInfo;
  summary?: ParsedField<string>;
  skills: ParsedSkillEntry[];
  experience: ParsedEmployment[];
  education: ParsedEducationEntry[];
  certifications: ParsedCertification[];
  projects: ParsedProject[];
  awards?: ParsedAward[];
  publications?: ParsedPublication[];
  languages: ParsedField<string>[];
  metrics: ExperienceMetrics;
  insights: ParseInsights;
  rawText: string;
  source: FieldSource;
}
