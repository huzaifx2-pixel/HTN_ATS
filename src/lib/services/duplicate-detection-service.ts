import { prisma } from "@/lib/db";
import { generateDedupeHash } from "@/lib/utils";
import { identityFields, normalizeEmail, normalizeLinkedIn, normalizePhone } from "@/lib/identity/normalize";
import { upsertCandidateSearchIndex } from "@/lib/search/search-index";
import { enqueueCandidateMatch } from "@/lib/queue/match-queue";
import { invalidateOrgCache } from "@/lib/cache/ttl-cache";

type IdentityCandidate = {
  id: string;
  email?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  firstName: string;
  lastName: string;
  dedupeHash?: string | null;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  normalizedLinkedIn?: string | null;
  resumeFingerprint?: string | null;
};

export async function findDuplicateCandidates(
  organizationId: string,
  candidateId: string,
  loaded?: IdentityCandidate | null,
) {
  const candidate =
    loaded ??
    (await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        phone: true,
        linkedIn: true,
        firstName: true,
        lastName: true,
        dedupeHash: true,
        normalizedEmail: true,
        normalizedPhone: true,
        normalizedLinkedIn: true,
        resumeFingerprint: true,
      },
    }));
  if (!candidate) return [];

  const email = candidate.normalizedEmail ?? normalizeEmail(candidate.email);
  const phone = candidate.normalizedPhone ?? normalizePhone(candidate.phone);
  const linkedIn = candidate.normalizedLinkedIn ?? normalizeLinkedIn(candidate.linkedIn);
  const or: Array<Record<string, unknown>> = [];
  if (email) {
    or.push({ normalizedEmail: email });
    or.push({ email: { equals: email, mode: "insensitive" } });
  }
  if (phone && phone.length >= 7) {
    or.push({ normalizedPhone: phone });
    or.push({ phone: { contains: phone.slice(-7) } });
  }
  if (linkedIn) {
    or.push({ normalizedLinkedIn: linkedIn });
  }
  if (candidate.resumeFingerprint) {
    or.push({ resumeFingerprint: candidate.resumeFingerprint });
  }
  if (candidate.dedupeHash) {
    or.push({ dedupeHash: candidate.dedupeHash });
  } else {
    const hash = generateDedupeHash(candidate.email, `${candidate.firstName} ${candidate.lastName}`);
    if (hash) or.push({ dedupeHash: hash });
  }

  if (or.length === 0) return [];

  return prisma.candidate.findMany({
    where: {
      organizationId,
      deletedAt: null,
      NOT: { id: candidateId },
      OR: or as never,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      linkedIn: true,
      currentRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
}

export async function listDuplicateEmailGroups(organizationId?: string) {
  if (organizationId) {
    return prisma.$queryRaw<
      Array<{ organizationId: string; email: string; count: number; ids: string[] }>
    >`
      SELECT
        "organizationId",
        lower(email) AS email,
        COUNT(*)::int AS count,
        array_agg(id ORDER BY "createdAt" ASC) AS ids
      FROM "Candidate"
      WHERE email IS NOT NULL
        AND "deletedAt" IS NULL
        AND "organizationId" = ${organizationId}
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;
  }

  return prisma.$queryRaw<
    Array<{ organizationId: string; email: string; count: number; ids: string[] }>
  >`
    SELECT
      "organizationId",
      lower(email) AS email,
      COUNT(*)::int AS count,
      array_agg(id ORDER BY "createdAt" ASC) AS ids
    FROM "Candidate"
    WHERE email IS NOT NULL
      AND "deletedAt" IS NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;
}

export async function mergeCandidates(
  organizationId: string,
  primaryId: string,
  duplicateId: string,
) {
  const [primary, duplicate] = await Promise.all([
    prisma.candidate.findFirst({ where: { id: primaryId, organizationId, deletedAt: null } }),
    prisma.candidate.findFirst({ where: { id: duplicateId, organizationId, deletedAt: null } }),
  ]);
  if (!primary || !duplicate) throw new Error("Candidate not found");

  const identity = identityFields({
    email: primary.email ?? duplicate.email,
    phone: primary.phone ?? duplicate.phone,
    linkedIn: primary.linkedIn ?? duplicate.linkedIn,
    resumeFingerprint: primary.resumeFingerprint ?? duplicate.resumeFingerprint,
  });

  const [primaryApps, primaryMatches, primarySkills] = await Promise.all([
    prisma.application.findMany({ where: { candidateId: primaryId }, select: { jobId: true } }),
    prisma.jobMatch.findMany({ where: { candidateId: primaryId }, select: { jobId: true } }),
    prisma.candidateSkill.findMany({ where: { candidateId: primaryId }, select: { skillId: true } }),
  ]);
  const primaryJobIds = primaryApps.map((row) => row.jobId);
  const primaryMatchJobIds = primaryMatches.map((row) => row.jobId);
  const primarySkillIds = primarySkills.map((row) => row.skillId);

  await prisma.$transaction([
    prisma.application.deleteMany({
      where: { candidateId: duplicateId, jobId: { in: primaryJobIds } },
    }),
    prisma.application.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    }),
    prisma.jobMatch.deleteMany({
      where: { candidateId: duplicateId, jobId: { in: primaryMatchJobIds } },
    }),
    prisma.jobMatch.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    }),
    prisma.candidateSkill.deleteMany({
      where: { candidateId: duplicateId, skillId: { in: primarySkillIds } },
    }),
    prisma.candidateSkill.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    }),
    prisma.document.updateMany({
      where: { candidateId: duplicateId },
      data: { candidateId: primaryId },
    }),
    prisma.candidateActivity.create({
      data: {
        candidateId: primaryId,
        action: "candidate.merged",
        metadata: { mergedFrom: duplicateId, mergedName: `${duplicate.firstName} ${duplicate.lastName}` },
      },
    }),
    prisma.candidate.update({
      where: { id: primaryId },
      data: {
        email: primary.email ?? duplicate.email,
        phone: primary.phone ?? duplicate.phone,
        linkedIn: primary.linkedIn ?? duplicate.linkedIn,
        currentCompany: primary.currentCompany ?? duplicate.currentCompany,
        currentRole: primary.currentRole ?? duplicate.currentRole,
        ...identity,
      },
    }),
    prisma.candidate.update({
      where: { id: duplicateId },
      data: { deletedAt: new Date() },
    }),
  ]);

  await prisma.candidateSearchIndex.deleteMany({ where: { candidateId: duplicateId } });
  await upsertCandidateSearchIndex(primaryId);
  await invalidateOrgCache(organizationId);
  await enqueueCandidateMatch(organizationId, primaryId, "merge");

  return { primaryId };
}
