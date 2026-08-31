import type { ParsedContactInfo } from "./contact-types";
import type { StructuredParseResult } from "./pipeline/types";

export interface ParsedExperience {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  isCurrent?: boolean;
  responsibilities?: string[];
  achievements?: string[];
  technologies?: string[];
  location?: string;
}

export interface ParsedEducation {
  institution: string;
  degree?: string;
  field?: string;
  year?: string;
}

export interface ParsedResumeResult {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phoneCountryCode?: string;
  linkedIn?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  currentCompany?: string;
  currentRole?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  location?: string;
  workAuthorization?: string;
  availability?: string;
  summary?: string;
  contact?: ParsedContactInfo;
  skills: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  certifications: string[];
  projects?: unknown[];
  rawText: string;
  experienceYears?: number;
  structured?: StructuredParseResult;
}

export interface ResumeParserAdapter {
  parse(buffer: Buffer, mimeType: string, fileName?: string): Promise<ParsedResumeResult>;
}
