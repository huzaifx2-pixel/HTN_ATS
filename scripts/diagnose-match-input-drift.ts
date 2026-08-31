import { prisma } from "../src/lib/db";
import {
  buildWebsiteJobDescription,
  fetchAllWebsiteJobs,
  formatWebsiteJobLocation,
  getHeadsbaseJobsApiUrl,
} from "../src/lib/integrations/headsbase-jobs-api";
import { mapApiJobSource } from "../src/lib/integrations/canonical-job-mapping";
import {
  computeJobMatchInputHash,
  matchInputFieldsFromRequirements,
} from "../src/lib/jobs/match-input-hash";

function mappedFromApi(job: Awaited<ReturnType<typeof fetchAllWebsiteJobs>>[number]) {
  const skills = (job.skills ?? []).map((skill) => skill.trim()).filter(Boolean);
  return {
    title: job.title.trim(),
    description: buildWebsiteJobDescription(job) || null,
    location: formatWebsiteJobLocation(job),
    requirements: {
      skills,
      employmentType: job.employmentType ?? undefined,
      websiteSource: job.source ?? undefined,
      postedDate: job.postedDate ?? undefined,
    },
  };
}

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true, _count: { select: { jobs: true } } },
  });

  const org =
    orgs.find((o) => o.slug === "headsbase-consulting") ??
    orgs.sort((a, b) => b._count.jobs - a._count.jobs)[0];
  if (!org) throw new Error("org not found");

  const apiJobs = await fetchAllWebsiteJobs(getHeadsbaseJobsApiUrl());
  const apiByExternal = new Map(apiJobs.map((j) => [j.jobId, j]));

  const dbJobs = await prisma.job.findMany({
    where: { organizationId: org.id, externalId: { not: null } },
    select: {
      externalId: true,
      title: true,
      description: true,
      location: true,
      requirements: true,
      metadata: true,
    },
  });

  const counts = { hashDrift: 0, title: 0, description: 0, location: 0, total: 0 };
  const samples: Array<{ externalId: string; existingHash?: string; mappedHash: string }> = [];

  for (const existing of dbJobs) {
    const api = existing.externalId ? apiByExternal.get(existing.externalId) : undefined;
    if (!api) continue;
    const mapped = mappedFromApi(api);
    counts.total += 1;

    const mappedHash = computeJobMatchInputHash({
      title: mapped.title,
      description: mapped.description,
      location: mapped.location,
      skills: mapped.requirements.skills,
      employmentType: mapped.requirements.employmentType ?? null,
      websiteSource: mapped.requirements.websiteSource ?? null,
      postedDate: mapped.requirements.postedDate ?? null,
    });
    const existingHash = computeJobMatchInputHash(matchInputFieldsFromRequirements(existing));
    const storedHash =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>).matchInputHash
        : undefined;

    if (existingHash !== mappedHash) {
      counts.hashDrift += 1;
      if (existing.title !== mapped.title) counts.title += 1;
      if ((existing.description ?? "") !== (mapped.description ?? "")) counts.description += 1;
      if ((existing.location ?? "") !== (mapped.location ?? "")) counts.location += 1;
      if (samples.length < 5) {
        samples.push({
          externalId: existing.externalId!,
          existingHash: typeof storedHash === "string" ? storedHash : existingHash.slice(0, 12),
          mappedHash: mappedHash.slice(0, 12),
        });
      }
    }
  }

  console.log(JSON.stringify({ jobsCompared: counts.total, fieldDrift: counts, samples }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
