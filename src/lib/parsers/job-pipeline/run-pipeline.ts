import { sanitizePostgresText } from "@/lib/sanitize-postgres";
import { extractStructuredFromJob } from "./extract-structured";
import { buildJobCorpus, detectJobLanguage } from "./clean-text";
import {
  JOB_PARSER_VERSION,
  type JobPipelineInput,
  type StructuredJobParseResult,
} from "./types";

export function runJobParsePipeline(input: JobPipelineInput): StructuredJobParseResult {
  const corpus = sanitizePostgresText(buildJobCorpus(input)) ?? "";
  if (!corpus.trim()) {
    throw new Error("No readable job description text found.");
  }

  const source = input.source ?? "manual";
  const extracted = extractStructuredFromJob({ ...input, source });
  const wordCount = corpus.split(/\s+/).filter(Boolean).length;

  return {
    parserVersion: JOB_PARSER_VERSION,
    document: {
      source,
      externalId: input.externalId,
      wordCount,
      language: detectJobLanguage(corpus),
      parsedAt: new Date().toISOString(),
      parserVersion: JOB_PARSER_VERSION,
      sectionsFound: extracted.sectionsFound,
    },
    quality: extracted.quality,
    title: extracted.title,
    sections: extracted.sections,
    skills: extracted.skills,
    experience: extracted.experience,
    compensation: extracted.compensation,
    location: extracted.location,
    employmentType: extracted.employmentType,
    insights: extracted.insights,
    rawText: extracted.rawText,
    source,
  };
}

export function structuredToLegacyRequirements(structured: StructuredJobParseResult) {
  const requiredSkills = structured.skills.filter((s) => s.required).map((s) => s.skill.value);
  const preferredSkills = structured.skills.filter((s) => s.preferred).map((s) => s.skill.value);
  const allSkills =
    requiredSkills.length > 0
      ? [...new Set([...requiredSkills, ...preferredSkills])]
      : structured.skills.map((s) => s.skill.value);

  return {
    skills: allSkills,
    requiredSkills,
    preferredSkills,
    experienceYears: structured.experience.minYears?.value,
    certifications: structured.sections.certifications,
    parserVersion: structured.parserVersion,
  };
}

export function structuredToJobFields(structured: StructuredJobParseResult) {
  const requirements = structuredToLegacyRequirements(structured);

  return {
    requirements,
    experienceMin: structured.experience.minYears?.value ?? undefined,
    experienceMax: structured.experience.maxYears?.value ?? undefined,
    summary: structured.sections.summary?.value ?? undefined,
    structured,
    parseMetadata: {
      document: structured.document,
      quality: structured.quality,
      insights: structured.insights,
    },
    parserVersion: structured.parserVersion,
  };
}

export function jobInputFromRecord(job: {
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
  salaryMin?: unknown;
  salaryMax?: unknown;
  salaryCurrency?: string | null;
  externalId?: string | null;
  source?: string | null;
  requirements?: unknown;
}) {
  const req = (job.requirements ?? {}) as {
    skills?: string[];
    preferredSkills?: string[];
    requiredSkills?: string[];
  };

  const toNumber = (value: unknown): number | null => {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const sourceMap: Record<string, JobPipelineInput["source"]> = {
    WEBSITE: "api",
    MANUAL: "manual",
    IMPORT: "csv",
  };

  return {
    title: job.title,
    description: job.description,
    descriptionHtml: job.descriptionHtml,
    responsibilities: job.responsibilities,
    requirementsText: job.requirementsText,
    preferredQualifications: job.preferredQualifications,
    benefits: job.benefits,
    summary: job.summary,
    location: job.location,
    country: job.country,
    city: job.city,
    employmentType: job.employmentType ?? undefined,
    workplaceType: job.workplaceType ?? undefined,
    remote: job.remote,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: toNumber(job.salaryMin),
    salaryMax: toNumber(job.salaryMax),
    salaryCurrency: job.salaryCurrency,
    hintSkills: req.requiredSkills ?? req.skills,
    hintPreferredSkills: req.preferredSkills,
    externalId: job.externalId ?? undefined,
    source: (job.source && sourceMap[job.source]) || "manual",
  } satisfies JobPipelineInput;
}
