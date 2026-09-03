import type { Job } from "@prisma/client";
import {
  extractBulletLines,
  normalizeText,
  parseCommaList,
  parseJsonStringArray,
  uniqueSorted,
} from "@/lib/matching/recruiter-engine/text-utils";

export type RequirementKind = "skill" | "certification" | "experience" | "authorization" | "other";

export type ParsedRequirementItem = {
  text: string;
  kind: RequirementKind;
};

export type ParsedJobRequirements = {
  critical: ParsedRequirementItem[];
  coreSkills: string[];
  preferredSkills: string[];
  certifications: string[];
  criticalCertifications: string[];
  experienceYears?: number;
  experienceIsCritical: boolean;
  educationLevel?: string;
  industry?: string;
  tools: string[];
  responsibilities: string[];
};

type RawJobRequirements = {
  skills?: unknown;
  preferredSkills?: unknown;
  certifications?: unknown;
  mustHave?: unknown;
  critical?: unknown;
  experienceYears?: number;
  educationLevel?: string;
  industry?: string;
  tools?: unknown;
  responsibilities?: unknown;
};

const MUST_HAVE_RE =
  /\b(must[- ]have|must possess|must be|mandatory|is required|are required)\b/i;
const PREFERRED_CUE_RE = /\b(nice to have|preferred|plus|a plus|bonus|optional)\b/i;
const CRITICAL_YEARS_RE =
  /\b(?:minimum|at least|must have|required)\b.{0,40}\d{1,2}\+?\s*(?:years?|yrs?)\b|\b\d{1,2}\+?\s*(?:years?|yrs?).{0,30}\b(?:required|mandatory|minimum)\b/i;
const CRITICAL_CERT_RE =
  /\b(?:certification|license|licensure)\b.{0,40}\b(?:required|mandatory|must)\b|\b(?:required|mandatory|must)\b.{0,40}\b(?:certification|license|licensure)\b/i;
const AUTHORIZATION_RE =
  /\b(?:work authorization|us citizen|u\.s\. citizen|security clearance|visa status)\b.{0,30}\b(?:required|must|mandatory)\b/i;

function jobText(job: Job) {
  return [job.title, job.description, job.responsibilities, job.requirementsText, job.preferredQualifications]
    .filter(Boolean)
    .join("\n");
}

function splitSentences(text: string) {
  return text
    .split(/[\n.;]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 3);
}

function mentionedIn(sentence: string, term: string) {
  const haystack = normalizeText(sentence);
  const needle = normalizeText(term);
  return Boolean(needle) && haystack.includes(needle);
}

function isLaundryList(sentence: string) {
  const commaCount = (sentence.match(/,/g) ?? []).length;
  return commaCount >= 2;
}

function recruiterMarkedCritical(req: RawJobRequirements) {
  return uniqueSorted([...parseJsonStringArray(req.mustHave), ...parseJsonStringArray(req.critical)]);
}

function promoteSkillToCritical(skill: string, sentences: string[], recruiterMarked: string[]) {
  if (recruiterMarked.some((item) => normalizeText(item) === normalizeText(skill))) return true;

  return sentences.some((sentence) => {
    if (!mentionedIn(sentence, skill)) return false;
    if (PREFERRED_CUE_RE.test(sentence)) return false;
    if (!MUST_HAVE_RE.test(sentence)) return false;
    if (isLaundryList(sentence)) return false;
    return true;
  });
}

function promoteCertToCritical(cert: string, sentences: string[], recruiterMarked: string[]) {
  if (recruiterMarked.some((item) => normalizeText(item) === normalizeText(cert))) return true;
  return sentences.some((sentence) => {
    if (!mentionedIn(sentence, cert)) return false;
    if (PREFERRED_CUE_RE.test(sentence)) return false;
    return CRITICAL_CERT_RE.test(sentence) || MUST_HAVE_RE.test(sentence);
  });
}

/**
 * Parse JD + stored requirements into critical / core / preferred.
 * Default extracted skills are core. Critical only when the JD uses must/required
 * language for a specific item, or the recruiter marked must-have.
 */
export function parseJobRequirementTiers(job: Job): ParsedJobRequirements {
  const req = (job.requirements ?? {}) as RawJobRequirements;
  const text = jobText(job);
  const sentences = splitSentences(text);
  const recruiterMarked = recruiterMarkedCritical(req);

  const listedSkills = uniqueSorted([
    ...parseJsonStringArray(req.skills),
    ...parseCommaList(job.requirementsText),
  ]);
  const preferredSkills = uniqueSorted([
    ...parseJsonStringArray(req.preferredSkills),
    ...parseCommaList(job.preferredQualifications),
  ]);
  const certifications = parseJsonStringArray(req.certifications);

  const criticalSkills = listedSkills.filter((skill) =>
    promoteSkillToCritical(skill, sentences, recruiterMarked)
  );
  const coreSkills = listedSkills.filter(
    (skill) => !criticalSkills.some((item) => normalizeText(item) === normalizeText(skill))
  );
  const criticalCertifications = certifications.filter((cert) =>
    promoteCertToCritical(cert, sentences, recruiterMarked)
  );

  const experienceYears = req.experienceYears ?? job.experienceMin ?? undefined;
  const experienceIsCritical = Boolean(experienceYears) && CRITICAL_YEARS_RE.test(text);

  const critical: ParsedRequirementItem[] = [
    ...criticalSkills.map((text) => ({ text, kind: "skill" as const })),
    ...criticalCertifications.map((text) => ({ text, kind: "certification" as const })),
    ...recruiterMarked
      .filter(
        (item) =>
          !listedSkills.some((skill) => normalizeText(skill) === normalizeText(item)) &&
          !certifications.some((cert) => normalizeText(cert) === normalizeText(item))
      )
      .map((text) => ({ text, kind: "other" as const })),
  ];

  if (AUTHORIZATION_RE.test(text)) {
    critical.push({ text: "Work authorization", kind: "authorization" });
  }

  return {
    critical,
    coreSkills,
    preferredSkills,
    certifications,
    criticalCertifications,
    experienceYears,
    experienceIsCritical,
    educationLevel: req.educationLevel,
    industry: req.industry,
    tools: parseJsonStringArray(req.tools),
    responsibilities: uniqueSorted([
      ...parseJsonStringArray(req.responsibilities),
      ...extractBulletLines(job.responsibilities ?? ""),
      ...extractBulletLines(job.description ?? "").slice(0, 8),
    ]),
  };
}
