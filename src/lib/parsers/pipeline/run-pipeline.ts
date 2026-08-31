import { sanitizePostgresText } from "@/lib/sanitize-postgres";
import { isLikelyResumeText } from "@/lib/parsers/document-extract";
import { flattenContactFields } from "@/lib/parsers/contact-extraction";
import { cleanResumeText, detectLanguage, estimatePageCount } from "./clean-text";
import { extractStructuredFromText } from "./extract-structured";
import {
  PARSER_PIPELINE_VERSION,
  TAXONOMY_VERSION,
  type StructuredParseResult,
} from "./types";
import type { ExtractionMethod } from "./parsed-field";

export interface PipelineInput {
  rawText: string;
  mimeType: string;
  fileName?: string;
  ocrUsed?: boolean;
  ocrConfidence?: number;
  fingerprint?: string;
  extractionMethod?: ExtractionMethod;
  pageCount?: number;
}

function resumeTypeFromInput(mimeType: string, fileName?: string): string {
  const lower = fileName?.toLowerCase() ?? "";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "PDF";
  if (mimeType.includes("wordprocessingml") || lower.endsWith(".docx")) return "DOCX";
  if (mimeType === "application/msword" || lower.endsWith(".doc")) return "DOC";
  if (mimeType.includes("rtf") || lower.endsWith(".rtf")) return "RTF";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(lower)) return "IMAGE";
  return "TEXT";
}

/** Stage 2–4: clean → extract → validate/score */
export function runParsePipeline(input: PipelineInput): StructuredParseResult {
  const text = cleanResumeText(sanitizePostgresText(input.rawText) ?? "");

  if (!text.trim()) {
    throw new Error("No readable text found in the document.");
  }

  if (!isLikelyResumeText(text) && text.length < 200) {
    const hasContact = /@/.test(text) || /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(text);
    const isPdf = input.mimeType === "application/pdf" || input.fileName?.toLowerCase().endsWith(".pdf");
    if (!hasContact && !(isPdf && text.trim().length >= 50)) {
      throw new Error("Document does not appear to be a resume.");
    }
  }

  const resumeType = resumeTypeFromInput(input.mimeType, input.fileName);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const extracted = extractStructuredFromText({
    rawText: text,
    resumeType,
    ocrUsed: input.ocrUsed ?? false,
    ocrConfidence: input.ocrConfidence,
    fileName: input.fileName,
  });

  const source = input.ocrUsed ? ("ocr" as const) : ("resume" as const);
  const extractionMethod: ExtractionMethod =
    input.extractionMethod ?? (input.ocrUsed ? "ocr" : "regex");

  return {
    parserVersion: PARSER_PIPELINE_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    document: {
      fileType: resumeType,
      fileName: input.fileName,
      wordCount,
      pageEstimate: input.pageCount ?? estimatePageCount(wordCount),
      language: detectLanguage(text),
      ocrUsed: input.ocrUsed ?? false,
      ocrConfidence: input.ocrConfidence,
      uploadedAt: new Date().toISOString(),
      lastParsedAt: new Date().toISOString(),
      parserVersion: PARSER_PIPELINE_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      fingerprint: input.fingerprint,
      extractionMethod,
    },
    quality: extracted.quality,
    contact: extracted.contact,
    summary: extracted.summary,
    skills: extracted.skills,
    experience: extracted.experience,
    education: extracted.education,
    certifications: extracted.certifications,
    projects: extracted.projects,
    awards: extracted.awards,
    publications: extracted.publications,
    languages: extracted.languages,
    metrics: extracted.metrics,
    insights: extracted.insights,
    rawText: text,
    source,
  };
}

export function structuredToLegacyResult(structured: StructuredParseResult) {
  const flat = flattenContactFields(structured.contact);
  const current = structured.experience.find((job) => job.isCurrent) ?? structured.experience[0];

  return {
    ...flat,
    contact: structured.contact,
    currentCompany: current?.company.value,
    currentRole: current?.jobTitle.value,
    summary: structured.summary?.value,
    skills: structured.skills.filter((s) => s.skill.confidence >= 0.5).map((s) => s.skill.value),
    experience: structured.experience.map((e) => ({
      company: e.company.value,
      role: e.jobTitle.value,
      startDate: e.startDate?.value,
      endDate: e.endDate?.value,
      description: e.responsibilities.join(" "),
      isCurrent: e.isCurrent,
      responsibilities: e.responsibilities,
      achievements: e.achievements,
      technologies: e.technologies,
      location: e.location?.value,
    })),
    education: structured.education.map((e) => ({
      institution: e.institution.value,
      degree: e.degree?.value,
      field: e.field?.value,
      year: e.graduationDate,
    })),
    certifications: structured.certifications.map((c) => c.name.value),
    projects: structured.projects,
    rawText: structured.rawText,
    experienceYears: structured.metrics.totalYears > 0 ? structured.metrics.totalYears : undefined,
    structured,
  };
}

export type LegacyParsedFromPipeline = ReturnType<typeof structuredToLegacyResult>;
