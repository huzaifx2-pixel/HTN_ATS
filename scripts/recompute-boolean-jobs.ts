import { prisma } from "../src/lib/db";
import { recomputeJobMatches, jobHasBooleanSearch } from "../src/lib/matching/service";

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: "headsbase-consulting" },
    select: { id: true },
  });
  if (!org) return;

  const jobs = await prisma.job.findMany({
    where: { organizationId: org.id, status: "OPEN" },
    select: { id: true, jobCode: true, title: true, booleanSearch: true },
  });

  let rematched = 0;
  for (const job of jobs) {
    if (!jobHasBooleanSearch(job)) continue;
    await recomputeJobMatches(job.id, org.id);
    rematched += 1;
    console.log(`Rematched ${job.jobCode} — ${job.title}`);
  }

  console.log(`Done. Rematched ${rematched} jobs with boolean search.`);
}

main().finally(() => prisma.$disconnect());
