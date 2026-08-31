import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { sanitizeForPostgresJson } from "@/lib/sanitize-postgres";
import type { StructuredJobParseResult } from "@/lib/parsers/job-pipeline/types";
import { structuredToLegacyRequirements } from "@/lib/parsers/job-pipeline/run-pipeline";
import { DEFAULT_SKILL_CATEGORIES } from "@/lib/parsers/pipeline/skill-taxonomy";

let skillCategoriesReady = false;

async function ensureSkillCategories() {
  if (skillCategoriesReady) return;

  for (const name of DEFAULT_SKILL_CATEGORIES) {
    await prisma.skillCategory.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  skillCategoriesReady = true;
}

export async function persistStructuredJob(jobId: string, structured: StructuredJobParseResult) {
  await ensureSkillCategories();

  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    select: { requirements: true, summary: true },
  });
  const existingRequirements =
    existing?.requirements && typeof existing.requirements === "object"
      ? (existing.requirements as Record<string, unknown>)
      : {};

  const categories = await prisma.skillCategory.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  const entries = structured.skills
    .map((entry) => ({ ...entry, name: entry.skill.value.trim() }))
    .filter((entry) => entry.name.length > 0);

  const uniqueNames = [...new Set(entries.map((entry) => entry.name))];

  if (uniqueNames.length > 0) {
    const existing = await prisma.skill.findMany({
      where: { name: { in: uniqueNames } },
      select: { id: true, name: true },
    });
    const known = new Set(existing.map((skill) => skill.name));
    const missing = uniqueNames.filter((name) => !known.has(name));

    if (missing.length > 0) {
      await prisma.skill.createMany({
        data: missing.map((name) => ({
          name,
          metadata: { canonical: name } as object,
        })),
        skipDuplicates: true,
      });
    }

    const skills = await prisma.skill.findMany({
      where: { name: { in: uniqueNames } },
      select: { id: true, name: true },
    });
    const skillIdByName = new Map(skills.map((skill) => [skill.name, skill.id]));

    const categoryAssignments = entries
      .map((entry) => {
        const skillId = skillIdByName.get(entry.name);
        const categoryId = categoryByName.get(entry.category);
        if (!skillId || !categoryId) return null;
        return { skillId, categoryId };
      })
      .filter((row): row is { skillId: string; categoryId: string } => row !== null);

    if (categoryAssignments.length > 0) {
      await prisma.skillCategoryAssignment.createMany({
        data: categoryAssignments,
        skipDuplicates: true,
      });
    }

    const jobSkills = entries
      .map((entry) => {
        const skillId = skillIdByName.get(entry.name);
        if (!skillId) return null;
        return {
          jobId,
          skillId,
          required: entry.required,
          priority: entry.required ? 1 : entry.preferred ? 2 : 3,
          metadata: {
            confidence: entry.skill.confidence,
            evidence: entry.skill.evidence,
            category: entry.category,
            preferred: entry.preferred,
            explicit: entry.explicit,
            source: entry.skill.source,
          } as object,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    await prisma.jobSkill.deleteMany({ where: { jobId } });
    if (jobSkills.length > 0) {
      await prisma.jobSkill.createMany({
        data: jobSkills,
        skipDuplicates: true,
      });
    }
  } else {
    await prisma.jobSkill.deleteMany({ where: { jobId } });
  }

  const parsedRequirements = structuredToLegacyRequirements(structured);
  const safeStructured = sanitizeForPostgresJson(structured);

  // API / form skills live in requirements.skills. Parser output goes to parsedSkills only.
  const apiSkills = Array.isArray(existingRequirements.skills)
    ? existingRequirements.skills.map(String)
    : [];
  const requirements = {
    ...existingRequirements,
    skills: apiSkills.length > 0 ? apiSkills : parsedRequirements.skills,
    parsedSkills: parsedRequirements.skills,
    requiredSkills: parsedRequirements.requiredSkills,
    preferredSkills: parsedRequirements.preferredSkills,
    experienceYears: parsedRequirements.experienceYears,
    certifications: parsedRequirements.certifications,
    parserVersion: parsedRequirements.parserVersion,
  };

  await prisma.job.update({
    where: { id: jobId },
    data: {
      requirements: requirements as object,
      experienceMin: structured.experience.minYears?.value ?? undefined,
      experienceMax: structured.experience.maxYears?.value ?? undefined,
      summary: existing?.summary?.trim()
        ? undefined
        : (structured.sections.summary?.value ?? undefined),
      structured: safeStructured as object,
      parseMetadata: {
        document: structured.document,
        quality: structured.quality,
        insights: structured.insights,
      } as object,
      parserVersion: structured.parserVersion,
    } as Prisma.JobUpdateInput,
  });
}

export async function parseAndPersistJob(
  jobId: string,
  input: Parameters<typeof import("@/lib/parsers/job-pipeline/run-pipeline").runJobParsePipeline>[0]
) {
  const { runJobParsePipeline } = await import("@/lib/parsers/job-pipeline/run-pipeline");
  const structured = runJobParsePipeline(input);
  await persistStructuredJob(jobId, structured);
  return structured;
}
