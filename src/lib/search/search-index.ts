import { prisma } from "@/lib/db";
import { parseSkills } from "@/lib/utils";

const CANDIDATE_DOC_LIMIT = 180_000;
const JOB_DOC_LIMIT = 60_000;

function joinParts(parts: Array<string | null | undefined>, limit: number) {
  return parts
    .flatMap((part) => (part ? [String(part).trim()] : []))
    .filter(Boolean)
    .join(" ")
    .slice(0, limit);
}

export async function upsertCandidateSearchIndex(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      organizationId: true,
      deletedAt: true,
      firstName: true,
      lastName: true,
      email: true,
      headline: true,
      summary: true,
      currentRole: true,
      currentTitle: true,
      currentCompany: true,
      location: true,
      city: true,
      country: true,
      workAuthorization: true,
      skills: true,
      parsedResume: { select: { rawText: true, summary: true } },
    },
  });
  if (!candidate || candidate.deletedAt) {
    await prisma.candidateSearchIndex.deleteMany({ where: { candidateId } });
    return;
  }

  const searchDocument = joinParts(
    [
      candidate.firstName,
      candidate.lastName,
      candidate.email,
      candidate.headline,
      candidate.summary,
      candidate.currentRole,
      candidate.currentTitle,
      candidate.currentCompany,
      candidate.location,
      candidate.city,
      candidate.country,
      candidate.workAuthorization,
      parseSkills(candidate.skills).join(" "),
      candidate.parsedResume?.summary,
      candidate.parsedResume?.rawText?.slice(0, 120_000),
    ],
    CANDIDATE_DOC_LIMIT,
  );

  await prisma.candidateSearchIndex.upsert({
    where: { candidateId },
    create: {
      candidateId,
      organizationId: candidate.organizationId,
      searchDocument,
    },
    update: { searchDocument },
  });
}

export async function upsertJobSearchIndex(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      jobCode: true,
      location: true,
      city: true,
      country: true,
      department: true,
      seniority: true,
      booleanSearch: true,
      description: true,
    },
  });
  if (!job) {
    await prisma.jobSearchIndex.deleteMany({ where: { jobId } });
    return;
  }

  const searchDocument = joinParts(
    [
      job.title,
      job.jobCode,
      job.location,
      job.city,
      job.country,
      job.department,
      job.seniority,
      job.booleanSearch,
      job.description?.slice(0, 20_000),
    ],
    JOB_DOC_LIMIT,
  );

  await prisma.jobSearchIndex.upsert({
    where: { jobId },
    create: {
      jobId,
      organizationId: job.organizationId,
      searchDocument,
    },
    update: { searchDocument },
  });
}
