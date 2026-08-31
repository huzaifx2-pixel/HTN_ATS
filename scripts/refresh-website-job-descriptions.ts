import { prisma } from "../src/lib/db";
import {
  buildWebsiteJobDescription,
  extractWebsiteJobIntro,
  fetchAllWebsiteJobs,
  getHeadsbaseJobsApiUrl,
} from "../src/lib/integrations/headsbase-jobs-api";
import { buildJobSummary } from "../src/lib/integrations/canonical-job-mapping";

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: "headsbase-consulting" },
    select: { id: true, name: true },
  });
  if (!org) {
    console.log("Org not found");
    return;
  }

  const apiJobs = await fetchAllWebsiteJobs(getHeadsbaseJobsApiUrl());
  const apiByExternalId = new Map(apiJobs.map((job) => [job.jobId, job]));

  const syncedJobs = await prisma.job.findMany({
    where: { organizationId: org.id, externalId: { not: null } },
    select: { id: true, externalId: true, jobCode: true },
  });

  let updated = 0;
  for (const row of syncedJobs) {
    const apiJob = row.externalId ? apiByExternalId.get(row.externalId) : undefined;
    if (!apiJob) continue;

    const description = buildWebsiteJobDescription(apiJob);
    const summary = buildJobSummary(extractWebsiteJobIntro(apiJob.description) || apiJob.description);

    await prisma.job.update({
      where: { id: row.id },
      data: {
        description,
        summary,
        responsibilities: apiJob.responsibilities?.trim() || null,
        requirementsText: apiJob.requirements?.trim() || null,
        preferredQualifications: apiJob.preferredQualifications?.trim() || null,
        requirements: {
          skills: (apiJob.skills ?? []).map((skill) => skill.trim()).filter(Boolean),
          employmentType: apiJob.employmentType ?? undefined,
          websiteSource: apiJob.source ?? undefined,
          postedDate: apiJob.postedDate ?? undefined,
        },
      },
    });
    updated += 1;
  }

  console.log(`Refreshed descriptions for ${updated} website jobs in ${org.name}`);
}

main().finally(() => prisma.$disconnect());
