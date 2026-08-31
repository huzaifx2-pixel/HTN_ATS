import { extractSkills } from "@/lib/parsers/extraction";
import { field } from "@/lib/parsers/pipeline/parsed-field";
import { normalizeSkill, normalizeJobTitle } from "@/lib/parsers/pipeline/normalize";
import { categorizeSkill, SKILL_CATEGORIES } from "@/lib/parsers/pipeline/skill-taxonomy";
import { buildJobCorpus } from "./clean-text";
import type {
  JobCompensation,
  JobExperienceRequirement,
  JobFieldSource,
  JobLocationInfo,
  JobPipelineInput,
  JobQualityScores,
  JobSections,
  JobSkillEntry,
  JobParseInsights,
} from "./types";

const JOB_SECTION_HEADERS: Record<string, RegExp> = {
  responsibilities: /^(key\s+)?responsibilities|what you('ll| will) do|duties|role overview/i,
  requirements: /^(minimum\s+)?requirements|qualifications|must have|required skills|what you('ll| will) need/i,
  preferred: /^preferred|nice to have|bonus|desired/i,
  benefits: /^benefits|perks|what we offer|compensation/i,
  summary: /^about (the )?(role|job|position)|overview|summary/i,
};

function splitListItems(text: string): string[] {
  return text
    .split(/\n|(?:^|\n)\s*[-•*]\s+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 2 && line.length < 500);
}

function parseSectionsFromText(text: string): JobSections {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: JobSections = {
    responsibilities: [],
    requirements: [],
    preferredQualifications: [],
    benefits: [],
    certifications: [],
  };

  let current: keyof typeof JOB_SECTION_HEADERS | null = null;

  for (const line of lines) {
    const header = (Object.entries(JOB_SECTION_HEADERS) as [keyof typeof JOB_SECTION_HEADERS, RegExp][])
      .find(([, re]) => re.test(line) && line.length < 80);

    if (header) {
      current = header[0] === "preferred" ? "preferred" : header[0];
      continue;
    }

    if (!current) continue;

    if (current === "responsibilities") sections.responsibilities.push(line);
    else if (current === "requirements") sections.requirements.push(line);
    else if (current === "preferred") sections.preferredQualifications.push(line);
    else if (current === "benefits") sections.benefits.push(line);
  }

  return sections;
}

function mergeSections(input: JobPipelineInput, parsed: JobSections): JobSections {
  const responsibilities = input.responsibilities
    ? splitListItems(input.responsibilities)
    : parsed.responsibilities;
  const requirements = input.requirementsText
    ? splitListItems(input.requirementsText)
    : parsed.requirements;
  const preferredQualifications = input.preferredQualifications
    ? splitListItems(input.preferredQualifications)
    : parsed.preferredQualifications;

  const certPattern = /\b(AWS|Azure|GCP|PMP|CISSP|CPA|CFA|Scrum|ITIL|CompTIA|CCNA|CKA)\b[^.\n]*/gi;
  const corpus = buildJobCorpus(input);
  const certifications = [...new Set((corpus.match(certPattern) ?? []).map((c) => c.trim()))];

  return {
    summary: input.summary ? field(input.summary.trim(), { confidence: 0.95, source: "manual" }) : parsed.summary,
    responsibilities: responsibilities.length > 0 ? responsibilities : parsed.responsibilities,
    requirements: requirements.length > 0 ? requirements : parsed.requirements,
    preferredQualifications:
      preferredQualifications.length > 0 ? preferredQualifications : parsed.preferredQualifications,
    benefits: input.benefits ? splitListItems(input.benefits) : parsed.benefits,
    certifications,
  };
}

function parseExplicitSkills(text: string, source: JobFieldSource): string[] {
  const skills: string[] = [];
  const listPattern = /(?:skills?|technologies|tools?|stack)[:\s]+([^\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = listPattern.exec(text)) !== null) {
    for (const part of match[1].split(/[,;|/•]/)) {
      const trimmed = part.trim();
      if (trimmed.length > 1 && trimmed.length < 60) skills.push(trimmed);
    }
  }
  return skills;
}

function taxonomyPhraseMatch(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const keywords of Object.values(SKILL_CATEGORIES)) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (pattern.test(lower)) found.push(keyword);
    }
  }

  return found;
}

function buildSkillEntries(
  corpus: string,
  sections: JobSections,
  input: JobPipelineInput,
  source: JobFieldSource
): JobSkillEntry[] {
  const requiredText = sections.requirements.join("\n");
  const preferredText = sections.preferredQualifications.join("\n");
  const requiredLower = requiredText.toLowerCase();
  const preferredLower = preferredText.toLowerCase();

  const candidates = new Map<string, { required: boolean; preferred: boolean; explicit: boolean; evidence?: string }>();

  const addSkill = (
    raw: string,
    opts: { required?: boolean; preferred?: boolean; explicit?: boolean; evidence?: string }
  ) => {
    const canonical = normalizeSkill(raw);
    if (!canonical || canonical.length < 2) return;
    const key = canonical.toLowerCase();
    const existing = candidates.get(key);
    candidates.set(key, {
      required: existing?.required || opts.required || false,
      preferred: existing?.preferred || opts.preferred || false,
      explicit: existing?.explicit || opts.explicit || false,
      evidence: opts.evidence ?? existing?.evidence,
    });
  };

  for (const skill of input.hintSkills ?? []) {
    addSkill(skill, { required: true, explicit: true, evidence: "api hint" });
  }
  for (const skill of input.hintPreferredSkills ?? []) {
    addSkill(skill, { preferred: true, explicit: true, evidence: "api hint preferred" });
  }

  for (const skill of parseExplicitSkills(requiredText, source)) {
    addSkill(skill, { required: true, explicit: true, evidence: "requirements section" });
  }
  for (const skill of parseExplicitSkills(preferredText, source)) {
    addSkill(skill, { preferred: true, explicit: true, evidence: "preferred section" });
  }

  for (const skill of extractSkills(corpus)) {
    const key = skill.toLowerCase();
    const inRequired = requiredLower.includes(key);
    const inPreferred = preferredLower.includes(key);
    addSkill(skill, {
      required: inRequired,
      preferred: inPreferred && !inRequired,
      explicit: inRequired || inPreferred,
      evidence: inRequired ? "requirements section" : inPreferred ? "preferred section" : "body text",
    });
  }

  for (const phrase of taxonomyPhraseMatch(corpus)) {
    const canonical = normalizeSkill(phrase);
    const key = canonical.toLowerCase();
    const inRequired = requiredLower.includes(key);
    const inPreferred = preferredLower.includes(key);
    if (!candidates.has(key)) {
      addSkill(phrase, {
        required: inRequired,
        preferred: inPreferred,
        explicit: false,
        evidence: "taxonomy match",
      });
    }
  }

  return [...candidates.entries()].map(([key, meta]) => {
    const value = normalizeSkill(key);
    return {
      skill: field(value, {
        confidence: meta.explicit ? 0.9 : 0.65,
        source: meta.explicit ? source : "inferred",
        evidence: meta.evidence,
        section: meta.required ? "requirements" : meta.preferred ? "preferred" : undefined,
      }),
      category: categorizeSkill(value),
      required: meta.required,
      preferred: meta.preferred,
      explicit: meta.explicit,
    };
  });
}

function extractExperience(text: string, input: JobPipelineInput): JobExperienceRequirement {
  const result: JobExperienceRequirement = {};

  if (input.experienceMin != null) {
    result.minYears = field(input.experienceMin, { confidence: 0.95, source: "manual" });
  } else {
    const minMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i);
    if (minMatch) {
      result.minYears = field(Number(minMatch[1]), {
        confidence: 0.85,
        source: "inferred",
        evidence: minMatch[0],
      });
    }
  }

  if (input.experienceMax != null) {
    result.maxYears = field(input.experienceMax, { confidence: 0.95, source: "manual" });
  }

  const seniorityMatch = text.match(/\b(junior|mid-?level|senior|lead|principal|staff|director|manager)\b/i);
  if (seniorityMatch) {
    result.seniority = field(seniorityMatch[1], {
      confidence: 0.8,
      source: "inferred",
      evidence: seniorityMatch[0],
    });
  }

  return result;
}

function extractCompensation(text: string, input: JobPipelineInput): JobCompensation {
  const result: JobCompensation = {};

  if (input.salaryMin != null) result.salaryMin = field(input.salaryMin, { confidence: 0.95, source: "manual" });
  if (input.salaryMax != null) result.salaryMax = field(input.salaryMax, { confidence: 0.95, source: "manual" });
  if (input.salaryCurrency) result.currency = field(input.salaryCurrency, { confidence: 0.95, source: "manual" });

  if (!result.salaryMin) {
    const range = text.match(/\$\s*([\d,]+)\s*(?:-|to)\s*\$?\s*([\d,]+)/i);
    if (range) {
      result.salaryMin = field(Number(range[1].replace(/,/g, "")), { confidence: 0.75, source: "inferred" });
      result.salaryMax = field(Number(range[2].replace(/,/g, "")), { confidence: 0.75, source: "inferred" });
      result.currency = field("USD", { confidence: 0.7, source: "inferred" });
    }
  }

  return result;
}

function extractLocation(input: JobPipelineInput): JobLocationInfo {
  const result: JobLocationInfo = {};

  if (input.location) {
    result.raw = field(input.location.trim(), { confidence: 0.9, source: "manual" });
  }
  if (input.city) {
    result.city = field(input.city.trim(), { confidence: 0.9, source: "manual" });
  }
  if (input.country) {
    result.country = field(input.country.trim(), { confidence: 0.9, source: "manual" });
  }
  if (input.remote != null) {
    result.remote = field(input.remote, { confidence: 0.9, source: "manual" });
  }
  if (input.workplaceType) {
    result.workplaceType = field(input.workplaceType, { confidence: 0.9, source: "manual" });
  }

  return result;
}

function scoreQuality(sections: JobSections, skills: JobSkillEntry[]): JobQualityScores {
  const missing: string[] = [];
  if (sections.requirements.length === 0) missing.push("requirements");
  if (sections.responsibilities.length === 0) missing.push("responsibilities");
  if (skills.length === 0) missing.push("skills");

  const sectionScore =
    (sections.requirements.length > 0 ? 0.35 : 0) +
    (sections.responsibilities.length > 0 ? 0.35 : 0) +
    (sections.preferredQualifications.length > 0 ? 0.15 : 0) +
    (sections.benefits.length > 0 ? 0.15 : 0);

  const skillCoverage = Math.min(1, skills.length / 8);
  const completeness = Math.min(1, sectionScore + skillCoverage * 0.3);

  return {
    completeness: Math.round(completeness * 100) / 100,
    skillCoverage: Math.round(skillCoverage * 100) / 100,
    sectionCompleteness: Math.round(sectionScore * 100) / 100,
    overall: Math.round((completeness * 0.6 + skillCoverage * 0.4) * 100) / 100,
    missingSections: missing,
  };
}

function buildInsights(skills: JobSkillEntry[]): JobParseInsights {
  const required = skills.filter((s) => s.required);
  const preferred = skills.filter((s) => s.preferred);
  const topSkills = skills
    .slice()
    .sort((a, b) => b.skill.confidence - a.skill.confidence)
    .slice(0, 10)
    .map((s) => s.skill.value);

  const categories = skills.map((s) => s.category);
  const primaryCategory =
    categories.length > 0
      ? categories.sort((a, b) => categories.filter((c) => c === b).length - categories.filter((c) => c === a).length)[0]
      : undefined;

  const seniorityHints = skills.some((s) => /senior|lead|principal|staff/i.test(s.skill.value))
    ? "senior"
    : skills.some((s) => /junior|entry/i.test(s.skill.value))
      ? "junior"
      : undefined;

  return {
    primaryCategory,
    topSkills,
    requiredSkillCount: required.length,
    preferredSkillCount: preferred.length,
    estimatedSeniority: seniorityHints,
  };
}

export function extractStructuredFromJob(input: JobPipelineInput) {
  const source: JobFieldSource = input.source ?? "manual";
  const corpus = buildJobCorpus(input);
  const parsedSections = parseSectionsFromText(corpus);
  const sections = mergeSections(input, parsedSections);
  const skills = buildSkillEntries(corpus, sections, input, source);
  const experience = extractExperience(corpus, input);
  const compensation = extractCompensation(corpus, input);
  const location = extractLocation(input);
  const quality = scoreQuality(sections, skills);
  const insights = buildInsights(skills);

  const sectionsFound = [
    sections.summary ? "summary" : null,
    sections.responsibilities.length > 0 ? "responsibilities" : null,
    sections.requirements.length > 0 ? "requirements" : null,
    sections.preferredQualifications.length > 0 ? "preferred" : null,
    sections.benefits.length > 0 ? "benefits" : null,
  ].filter((s): s is string => s !== null);

  return {
    title: field(normalizeJobTitle(input.title), { confidence: 0.95, source }),
    sections,
    skills,
    experience,
    compensation,
    location,
    employmentType: input.employmentType
      ? field(input.employmentType, { confidence: 0.9, source })
      : undefined,
    quality,
    insights,
    sectionsFound,
    rawText: corpus,
  };
}
