import { extractRecruiterEntities } from "./entity-extractor";
import {
  expandJobTitles,
  matchJobFamily,
  titleBelongsToFamily,
  type JobFamilyTemplate,
} from "./job-family-templates";
import { isLowQualityTerm } from "./quality";
import { isSkillAllowedForFamily } from "./skill-catalog";
import { normalizeJobTitle } from "./title-normalize";
import type { RecruiterEntity } from "./entity-extractor";

export type BooleanGeneratorInput = {
  title: string;
  description?: string | null;
  requirements?: {
    skills?: string[];
    preferredSkills?: string[];
    certifications?: string[];
  };
  preferredQualifications?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
};

export function booleanGeneratorInputFromJob(job: {
  title: string;
  description?: string | null;
  requirements?: unknown;
  preferredQualifications?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
}): BooleanGeneratorInput {
  const requirements = (job.requirements as {
    skills?: string[];
    preferredSkills?: string[];
    certifications?: string[];
  } | null) ?? {};

  return {
    title: job.title,
    description: job.description,
    requirementsText: job.requirementsText,
    preferredQualifications: job.preferredQualifications,
    responsibilities: job.responsibilities,
    requirements: {
      skills: requirements.skills,
      preferredSkills: requirements.preferredSkills,
      certifications: requirements.certifications,
    },
  };
}

function formatTerm(term: string): string {
  const trimmed = term.trim();
  if (!trimmed) return "";
  if (/[\s/]/.test(trimmed)) return `"${trimmed}"`;
  return trimmed;
}

function formatOrBlock(terms: string[]): string | null {
  const unique = dedupeCaseInsensitive(terms);
  if (unique.length === 0) return null;
  return `(\n${unique.map(formatTerm).join("\nOR ")}\n)`;
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}

function dropSubsumedTerms(terms: string[]): string[] {
  return terms.filter((term) => {
    const lower = term.toLowerCase();
    return !terms.some((other) => {
      if (other.toLowerCase() === lower) return false;
      if (other.length <= term.length) return false;
      try {
        return new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`)}\\b`, "i").test(other);
      } catch {
        return false;
      }
    });
  });
}

function rankEntity(entity: RecruiterEntity): number {
  let score = 0;
  if (entity.source === "required") score += 1000;
  score += entity.jdMentions * 100;
  if (entity.source === "preferred") score += 50;
  if (entity.source === "dictionary") score += 20;
  if (entity.source === "list") score += 10;
  return score;
}

function filterTitles(titles: string[], family: JobFamilyTemplate, primary: string): string[] {
  const kept: string[] = [];
  for (const title of titles) {
    if (isLowQualityTerm(title) && title.toLowerCase() !== primary.toLowerCase()) continue;
    const isPrimary = title.toLowerCase() === primary.toLowerCase();
    if (!isPrimary && !titleBelongsToFamily(title, family)) continue;
    kept.push(title);
  }
  return dedupeCaseInsensitive(kept.length > 0 ? kept : [primary]);
}

function filterSkills(
  terms: string[],
  family: JobFamilyTemplate,
  options?: { required?: boolean; strict?: boolean },
): string[] {
  return dedupeCaseInsensitive(
    terms.filter((term) => !isLowQualityTerm(term) && isSkillAllowedForFamily(term, family, options)),
  );
}

function selectSkills(entities: RecruiterEntity[], family: JobFamilyTemplate, strict: boolean): {
  skills: string[];
  certifications: string[];
} {
  const ranked = [...entities].sort((a, b) => rankEntity(b) - rankEntity(a));
  const skillEntities = ranked.filter((entity) => entity.kind !== "certification");
  const certEntities = ranked.filter((entity) => entity.kind === "certification");

  const allowedSkills = dedupeCaseInsensitive(
    skillEntities
      .filter((entity) =>
        !isLowQualityTerm(entity.term) &&
        isSkillAllowedForFamily(entity.term, family, {
          required: entity.source === "required",
          strict,
        }),
      )
      .map((entity) => entity.term),
  );

  const requiredSkills = filterSkills(
    skillEntities.filter((entity) => entity.source === "required").map((entity) => entity.term),
    family,
    { required: true, strict },
  );

  const preferredAndJd = allowedSkills.filter(
    (term) => !requiredSkills.some((required) => required.toLowerCase() === term.toLowerCase()),
  );

  let skills = dropSubsumedTerms(dedupeCaseInsensitive([...requiredSkills, ...preferredAndJd])).slice(0, 15);

  if (!strict && family.id !== "generic" && skills.length < 3) {
    for (const core of family.coreSkills) {
      if (skills.length >= 15) break;
      if (isLowQualityTerm(core)) continue;
      if (!isSkillAllowedForFamily(core, family)) continue;
      if (skills.some((term) => term.toLowerCase() === core.toLowerCase())) continue;
      skills.push(core);
    }
  }

  skills = dropSubsumedTerms(skills).slice(0, 15);

  const certifications = dropSubsumedTerms(
    filterSkills(
      certEntities.map((entity) => entity.term),
      family,
      { strict: true },
    ),
  ).slice(0, 4);

  return { skills, certifications };
}

function outputIsValid(
  titles: string[],
  skills: string[],
  certifications: string[],
  family: JobFamilyTemplate,
  primary: string,
): boolean {
  if (titles.length === 0) return false;
  for (const title of titles) {
    if (title.toLowerCase() === primary.toLowerCase()) continue;
    if (!titleBelongsToFamily(title, family) || isLowQualityTerm(title)) return false;
  }
  for (const skill of [...skills, ...certifications]) {
    if (isLowQualityTerm(skill) || !isSkillAllowedForFamily(skill, family)) return false;
  }
  return true;
}

function buildQuery(titles: string[], skills: string[], certifications: string[]): string {
  const blocks: string[] = [];
  const titleBlock = formatOrBlock(titles);
  if (titleBlock) blocks.push(titleBlock);
  const skillBlock = formatOrBlock(skills);
  if (skillBlock) blocks.push(skillBlock);
  const certBlock = formatOrBlock(certifications);
  if (certBlock) blocks.push(certBlock);
  return blocks.join("\n\nAND\n\n");
}

/**
 * Builds a recruiter-grade Boolean search string from job title, description, and skills.
 */
export function generateBooleanSearch(input: BooleanGeneratorInput, strict = false): string {
  const title = input.title?.trim();
  if (!title) return "";

  const normalized = normalizeJobTitle(title);
  const family = matchJobFamily(normalized.primary, `${title}\n${input.description ?? ""}`);

  const expanded = strict
    ? expandJobTitles(normalized.primary, { ...family, relatedTitles: [] }, normalized.variants)
    : expandJobTitles(normalized.primary, family, normalized.variants);

  const titles = filterTitles(expanded, family, normalized.primary);

  const entities = extractRecruiterEntities({
    title: normalized.primary,
    description: input.description,
    requirementsText: input.requirementsText,
    preferredQualifications: input.preferredQualifications,
    hintSkills: input.requirements?.skills,
    hintPreferredSkills: input.requirements?.preferredSkills,
    hintCertifications: input.requirements?.certifications,
  });

  const { skills, certifications } = selectSkills(entities, family, strict);

  if (!strict && !outputIsValid(titles, skills, certifications, family, normalized.primary)) {
    return generateBooleanSearch(input, true);
  }

  return buildQuery(titles, skills, certifications);
}

export function resolveBooleanSearchForSave(input: {
  title: string;
  description?: string | null;
  requirements?: BooleanGeneratorInput["requirements"];
  preferredQualifications?: string | null;
  submittedBoolean?: string | null;
  manualOverride: boolean;
  forceRegenerate?: boolean;
}): string | null {
  const generated = generateBooleanSearch(input).trim();
  const submitted = input.submittedBoolean?.trim() ?? "";

  if (input.forceRegenerate) {
    return generated || submitted || null;
  }

  if (input.manualOverride && submitted) {
    return submitted;
  }

  return generated || submitted || null;
}
