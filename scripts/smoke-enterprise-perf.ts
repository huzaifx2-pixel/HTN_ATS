/**
 * Smoke-test enterprise search/index/profile paths against the live DB.
 * Usage: npx tsx scripts/smoke-enterprise-perf.ts
 */
import { prisma } from "../src/lib/db";
import { searchCandidates } from "../src/lib/search/candidate-fts";
import { booleanQueryToTsquery, plainQueryToTsquery } from "../src/lib/search/boolean-tsquery";

async function main() {
  const [candidateCount, indexCount, vectorCount, jobIndexCount, openJobs] = await Promise.all([
    prisma.candidate.count({ where: { deletedAt: null } }),
    prisma.candidateSearchIndex.count(),
    prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*)::int AS count FROM "CandidateSearchIndex" WHERE "searchVector" IS NOT NULL
    `,
    prisma.jobSearchIndex.count(),
    prisma.job.count({ where: { status: "OPEN" } }),
  ]);

  const org = await prisma.organization.findFirst({
    orderBy: { candidates: { _count: "desc" } },
    select: { id: true, name: true, _count: { select: { candidates: true } } },
  });
  if (!org) throw new Error("No organization");

  const tsquery = plainQueryToTsquery("Java AWS");
  const boolean = booleanQueryToTsquery("Java AND (AWS OR Azure) NOT intern");
  if (!tsquery) throw new Error("plain tsquery empty");
  if (!boolean.ok) throw new Error(boolean.error);

  const startedAll = performance.now();
  const all = await searchCandidates(org.id, { query: "Java", mode: "all", limit: 20 });
  const allMs = Math.round(performance.now() - startedAll);

  const startedBool = performance.now();
  const bool = await searchCandidates(org.id, {
    query: "Java AND (AWS OR Azure) NOT intern",
    mode: "boolean",
    limit: 20,
  });
  const boolMs = Math.round(performance.now() - startedBool);

  const startedName = performance.now();
  const name = await searchCandidates(org.id, { query: "John", mode: "name", limit: 20 });
  const nameMs = Math.round(performance.now() - startedName);

  const profileId = all.items[0]?.id ?? (await prisma.candidate.findFirst({ where: { organizationId: org.id, deletedAt: null }, select: { id: true } }))?.id;
  let profileMs = 0;
  if (profileId) {
    const startedProfile = performance.now();
    await prisma.candidate.findFirst({
      where: { id: profileId, organizationId: org.id },
      include: {
        parsedResume: {
          select: {
            skills: true,
            experience: true,
            education: true,
            certifications: true,
            structured: true,
            parseMetadata: true,
            projects: true,
            summary: true,
          },
        },
        documents: { select: { id: true, type: true, storageKey: true, fileName: true, mimeType: true, isLatest: true, createdAt: true }, take: 8 },
        candidateSkills: { include: { skill: true } },
        experiences: { orderBy: { startDate: "desc" }, take: 25 },
        applications: { take: 20, orderBy: { updatedAt: "desc" } },
        matches: { include: { job: { include: { client: { select: { id: true, name: true } } } } }, orderBy: { score: "desc" }, take: 25 },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    profileMs = Math.round(performance.now() - startedProfile);
  }

  console.log(JSON.stringify({
    organization: { id: org.id, name: org.name, candidates: org._count.candidates },
    candidateCount,
    searchIndexCount: indexCount,
    searchVectorCount: Number(vectorCount[0]?.count ?? 0),
    jobIndexCount,
    openJobs,
    search: {
      all: { ms: allMs, hits: all.items.length, total: all.total },
      boolean: { ms: boolMs, hits: bool.items.length, total: bool.total },
      name: { ms: nameMs, hits: name.items.length, total: name.total },
    },
    profileMs,
  }, null, 2));

  if (Number(vectorCount[0]?.count ?? 0) < candidateCount * 0.9) {
    throw new Error("CandidateSearchIndex searchVector backfill looks incomplete");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
