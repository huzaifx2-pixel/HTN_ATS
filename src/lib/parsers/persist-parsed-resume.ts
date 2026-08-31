import { prisma } from "@/lib/db";
import { sanitizeForPostgresJson, sanitizePostgresText } from "@/lib/sanitize-postgres";
import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";
import { DEFAULT_SKILL_CATEGORIES } from "@/lib/parsers/pipeline/skill-taxonomy";
import { normalizeEmployerKey } from "@/lib/parsers/pipeline/normalize";
import { isProtectedReviewStatus } from "@/lib/parsers/pipeline/parsed-field";

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

function experienceKey(title: string, company: string, start?: string | Date | null): string {
  const startKey =
    start instanceof Date ? start.toISOString().slice(0, 7) : (start ?? "").toString().slice(0, 7);
  return `${title.trim().toLowerCase()}|${company.trim().toLowerCase()}|${startKey}`;
}

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function upsertEmployer(organizationId: string, name: string) {
  const normalizedName = normalizeEmployerKey(name) || name.trim().toLowerCase();
  return prisma.employer.upsert({
    where: {
      organizationId_normalizedName: { organizationId, normalizedName },
    },
    create: { organizationId, name: name.trim(), normalizedName },
    update: { name: name.trim() },
  });
}

export async function persistStructuredParse(candidateId: string, structured: StructuredParseResult) {
  await ensureSkillCategories();

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { organizationId: true, currentEmployerId: true },
  });
  if (!candidate) return;

  const categories = await prisma.skillCategory.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  const entries = structured.skills
    .map((entry) => ({ ...entry, name: entry.skill.value.trim() }))
    .filter((entry) => entry.name.length > 0);

  const uniqueNames = [...new Set(entries.map((entry) => entry.name))];

  const existingSkills = await prisma.candidateSkill.findMany({
    where: { candidateId },
    include: { skill: { select: { id: true, name: true } } },
  });
  const protectedSkillIds = existingSkills
    .filter((row) => {
      const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
      return isProtectedReviewStatus(String(meta.reviewStatus ?? "")) || meta.source === "manual";
    })
    .map((row) => row.skillId);

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

    const candidateSkills = entries
      .map((entry) => {
        const skillId = skillIdByName.get(entry.name);
        if (!skillId || protectedSkillIds.includes(skillId)) return null;
        return {
          candidateId,
          skillId,
          yearsExperience: entry.yearsUsed ? Math.round(entry.yearsUsed) : undefined,
          proficiency: entry.explicit ? "explicit" : "inferred",
          verified: entry.skill.confidence >= 0.8,
          metadata: {
            confidence: entry.skill.confidence,
            evidence: entry.skill.evidence,
            category: entry.category,
            source: entry.skill.source,
            reviewStatus: entry.skill.reviewStatus,
            lastUsed: entry.lastUsed,
          } as object,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    await prisma.candidateSkill.deleteMany({
      where: {
        candidateId,
        ...(protectedSkillIds.length > 0 ? { skillId: { notIn: protectedSkillIds } } : {}),
      },
    });
    if (candidateSkills.length > 0) {
      await prisma.candidateSkill.createMany({
        data: candidateSkills,
        skipDuplicates: true,
      });
    }
  } else if (protectedSkillIds.length === 0) {
    await prisma.candidateSkill.deleteMany({ where: { candidateId } });
  }

  const existingExperiences = await prisma.candidateExperience.findMany({ where: { candidateId } });
  const protectedExperiences = existingExperiences.filter(
    (row) => isProtectedReviewStatus(row.reviewStatus) || row.source === "manual",
  );
  const protectedExpKeys = new Set(
    protectedExperiences.map((row) => experienceKey(row.title, row.company, row.startDate)),
  );
  await prisma.candidateExperience.deleteMany({
    where: {
      candidateId,
      ...(protectedExperiences.length > 0 ? { id: { notIn: protectedExperiences.map((row) => row.id) } } : {}),
    },
  });

  let currentEmployerId: string | undefined;
  for (const job of structured.experience) {
    const key = experienceKey(job.jobTitle.value, job.company.value, job.startDate?.value);
    if (protectedExpKeys.has(key)) continue;
    const employer = await upsertEmployer(candidate.organizationId, job.company.value);
    if (job.isCurrent) currentEmployerId = employer.id;
    await prisma.candidateExperience.create({
      data: {
        candidateId,
        employerId: employer.id,
        company: job.company.value,
        title: job.jobTitle.value,
        location: job.location?.value,
        startDate: parseIsoDate(job.startDate?.value),
        endDate: parseIsoDate(job.endDate?.value),
        isCurrent: job.isCurrent,
        durationMonths: job.durationMonths,
        confidence: job.jobTitle.confidence,
        reviewStatus: job.jobTitle.reviewStatus,
        extractionMethod: job.jobTitle.extractionMethod,
        source: job.jobTitle.source,
        responsibilities: job.responsibilities as object,
        metadata: {
          technologies: job.technologies,
          achievements: job.achievements,
        } as object,
      },
    });
  }

  const existingEducation = await prisma.candidateEducation.findMany({ where: { candidateId } });
  const protectedEducationIds = existingEducation
    .filter((row) => isProtectedReviewStatus(row.reviewStatus) || row.source === "manual")
    .map((row) => row.id);
  await prisma.candidateEducation.deleteMany({
    where: {
      candidateId,
      ...(protectedEducationIds.length > 0 ? { id: { notIn: protectedEducationIds } } : {}),
    },
  });
  const protectedEduKeys = new Set(
    existingEducation
      .filter((row) => protectedEducationIds.includes(row.id))
      .map((row) => `${row.institution}|${row.degree ?? ""}`.toLowerCase()),
  );
  for (const entry of structured.education) {
    const key = `${entry.institution.value}|${entry.degree?.value ?? ""}`.toLowerCase();
    if (protectedEduKeys.has(key)) continue;
    await prisma.candidateEducation.create({
      data: {
        candidateId,
        institution: entry.institution.value,
        degree: entry.degree?.value,
        field: entry.field?.value,
        honors: entry.honors,
        graduationDate: entry.graduationDate,
        confidence: entry.institution.confidence,
        reviewStatus: entry.institution.reviewStatus,
        extractionMethod: entry.institution.extractionMethod,
        source: entry.institution.source,
      },
    });
  }

  const existingCerts = await prisma.candidateCertification.findMany({ where: { candidateId } });
  const protectedCertIds = existingCerts
    .filter((row) => isProtectedReviewStatus(row.reviewStatus) || row.source === "manual")
    .map((row) => row.id);
  await prisma.candidateCertification.deleteMany({
    where: {
      candidateId,
      ...(protectedCertIds.length > 0 ? { id: { notIn: protectedCertIds } } : {}),
    },
  });
  const protectedCertKeys = new Set(
    existingCerts
      .filter((row) => protectedCertIds.includes(row.id))
      .map((row) => row.name.toLowerCase()),
  );
  for (const cert of structured.certifications) {
    if (protectedCertKeys.has(cert.name.value.toLowerCase())) continue;
    await prisma.candidateCertification.create({
      data: {
        candidateId,
        name: cert.name.value,
        issuer: cert.issuer?.value,
        issueDate: cert.issueDate,
        expiryDate: cert.expiryDate,
        credentialId: cert.credentialId,
        status: cert.status,
        confidence: cert.name.confidence,
        reviewStatus: cert.name.reviewStatus,
        extractionMethod: cert.name.extractionMethod,
        source: cert.name.source,
      },
    });
  }

  if (currentEmployerId) {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { currentEmployerId },
    });
  }

  const safeStructured = sanitizeForPostgresJson(structured);
  const safeRawText = sanitizePostgresText(structured.rawText);

  await prisma.parsedResume.upsert({
    where: { candidateId },
    create: {
      candidateId,
      rawText: safeRawText,
      skills: safeStructured.skills.map((s) => s.skill.value) as object,
      experience: safeStructured.experience as object,
      education: safeStructured.education as object,
      certifications: safeStructured.certifications.map((c) => c.name.value) as object,
      structured: safeStructured as object,
      parseMetadata: {
        document: safeStructured.document,
        quality: safeStructured.quality,
        metrics: safeStructured.metrics,
        insights: safeStructured.insights,
        taxonomyVersion: safeStructured.taxonomyVersion,
      } as object,
      parserVersion: safeStructured.parserVersion,
      summary: safeStructured.summary?.value,
      projects: safeStructured.projects as object,
    },
    update: {
      rawText: safeRawText,
      skills: safeStructured.skills.map((s) => s.skill.value) as object,
      experience: safeStructured.experience as object,
      education: safeStructured.education as object,
      certifications: safeStructured.certifications.map((c) => c.name.value) as object,
      structured: safeStructured as object,
      parseMetadata: {
        document: safeStructured.document,
        quality: safeStructured.quality,
        metrics: safeStructured.metrics,
        insights: safeStructured.insights,
        taxonomyVersion: safeStructured.taxonomyVersion,
      } as object,
      parserVersion: safeStructured.parserVersion,
      summary: safeStructured.summary?.value,
      projects: safeStructured.projects as object,
      parsedAt: new Date(),
    },
  });

  const { scheduleIndexSource } = await import("@/lib/rag/indexer");
  scheduleIndexSource({
    organizationId: candidate.organizationId,
    sourceType: "resume",
    sourceId: candidateId,
  });
  const { upsertCandidateSearchIndex } = await import("@/lib/search/search-index");
  await upsertCandidateSearchIndex(candidateId);
}

export function parseProfileMetadata(structured: StructuredParseResult) {
  return {
    parser_version: structured.parserVersion,
    taxonomy_version: structured.taxonomyVersion,
    parse_quality: structured.quality,
    experience_metrics: structured.metrics,
    insights: structured.insights,
    address: {
      state: structured.contact.address.state?.value,
      zip: structured.contact.address.zip?.value,
    },
    languages: structured.languages.map((l) => l.value),
    awards: (structured.awards ?? []).map((item) => item.name.value),
    publications: (structured.publications ?? []).map((item) => item.title.value),
    structured_skills: structured.skills.map((s) => ({
      name: s.skill.value,
      category: s.category,
      confidence: s.skill.confidence,
      evidence: s.skill.evidence,
      yearsUsed: s.yearsUsed,
    })),
  };
}
