import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AudienceFilters, MarketingAudienceRecipient } from "@/lib/marketing/types";
import type { ImportedContactRow } from "@/lib/marketing/parse-contact-import";
import { parseContactCsv, parseContactXlsx } from "@/lib/marketing/parse-contact-import";
import { blockedMarketingEmails } from "@/lib/services/contact-compliance-service";

export async function buildCandidateAudienceQuery(
  organizationId: string,
  filters: AudienceFilters,
  suppressedEmails: string[] = [],
): Promise<Prisma.CandidateWhereInput> {
  const where: Prisma.CandidateWhereInput = {
    organizationId,
    deletedAt: null,
    doNotContact: false,
    email: { not: null },
  };

  if (filters.candidateIds?.length) {
    where.id = { in: filters.candidateIds };
  }

  const orGroups: Prisma.CandidateWhereInput[] = [];

  if (filters.hasEmail !== false) {
    where.email = { not: null };
  }
  if (suppressedEmails.length > 0) {
    where.email = { notIn: suppressedEmails, not: null };
  }
  if (filters.location) {
    where.location = { contains: filters.location, mode: "insensitive" };
  }
  if (filters.country) {
    where.country = { contains: filters.country, mode: "insensitive" };
  }
  if (filters.city) {
    where.city = { contains: filters.city, mode: "insensitive" };
  }
  if (filters.jobTitle) {
    orGroups.push({
      OR: [
        { currentRole: { contains: filters.jobTitle, mode: "insensitive" } },
        { currentTitle: { contains: filters.jobTitle, mode: "insensitive" } },
      ],
    });
  }
  if (filters.status?.length) {
    where.status = { in: filters.status as Prisma.EnumCandidateStatusFilter["in"] };
  }
  if (filters.source?.length) {
    where.source = { in: filters.source as Prisma.EnumCandidateSourceFilter["in"] };
  }
  if (filters.minExperience !== undefined || filters.maxExperience !== undefined) {
    where.experienceYears = {};
    if (filters.minExperience !== undefined) where.experienceYears.gte = filters.minExperience;
    if (filters.maxExperience !== undefined) where.experienceYears.lte = filters.maxExperience;
  }
  if (filters.inactiveDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.inactiveDays);
    orGroups.push({
      OR: [
        { engagedAt: { lt: cutoff } },
        { engagedAt: null, updatedAt: { lt: cutoff } },
      ],
    });
  }
  if (filters.keywords) {
    orGroups.push({
      OR: [
        { summary: { contains: filters.keywords, mode: "insensitive" } },
        { currentRole: { contains: filters.keywords, mode: "insensitive" } },
        { headline: { contains: filters.keywords, mode: "insensitive" } },
      ],
    });
  }
  if (filters.pipelineStage?.length) {
    where.applications = {
      some: { stage: { in: filters.pipelineStage as Prisma.EnumPipelineStageFilter["in"] } },
    };
  }

  if (orGroups.length > 0) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...orGroups];
  }

  return where;
}

export async function countAudience(
  organizationId: string,
  filters: AudienceFilters,
  audienceId?: string,
) {
  if (filters.sourceType === "import" && audienceId) {
    const suppressed = await prisma.marketingSuppression.findMany({
      where: { organizationId },
      select: { email: true },
    });
    const blocked = new Set(suppressed.map((s) => s.email.toLowerCase()));
    const contacts = await prisma.marketingAudienceContact.findMany({
      where: { audienceId, organizationId },
      select: { email: true },
    });
    return contacts.filter((c) => !blocked.has(c.email.toLowerCase())).length;
  }

  const suppressed = await prisma.marketingSuppression.findMany({
    where: { organizationId },
    select: { email: true },
  });
  const where = await buildCandidateAudienceQuery(
    organizationId,
    filters,
    suppressed.map((s) => s.email),
  );
  return prisma.candidate.count({ where });
}

export async function resolveAudienceRecipients(
  organizationId: string,
  filters: AudienceFilters,
  audienceId?: string,
  limit = 5000,
): Promise<MarketingAudienceRecipient[]> {
  if (filters.sourceType === "import" && audienceId) {
    const contacts = await prisma.marketingAudienceContact.findMany({
      where: { audienceId, organizationId },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    const blocked = await blockedMarketingEmails(
      organizationId,
      contacts.map((c) => c.email),
    );

    return contacts
      .filter((c) => !blocked.has(c.email.toLowerCase()))
      .map((c) => ({
        email: c.email,
        name: c.contactName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email,
        importMeta: {
          contactName: c.contactName ?? undefined,
          firstName: c.firstName ?? undefined,
          lastName: c.lastName ?? undefined,
          title: c.title ?? undefined,
          department: c.department ?? undefined,
          company: c.company ?? undefined,
        },
      }));
  }

  const suppressed = await prisma.marketingSuppression.findMany({
    where: { organizationId },
    select: { email: true },
  });
  const where = await buildCandidateAudienceQuery(
    organizationId,
    filters,
    suppressed.map((s) => s.email),
  );

  return prisma.candidate.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      currentCompany: true,
      currentRole: true,
      location: true,
      phone: true,
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  }).then((candidates) =>
    candidates
      .filter((c) => c.email)
      .map((c) => ({
        email: c.email!,
        name: `${c.firstName} ${c.lastName}`.trim(),
        importMeta: {
          firstName: c.firstName,
          lastName: c.lastName,
          title: c.currentRole ?? undefined,
          company: c.currentCompany ?? undefined,
        },
      })),
  );
}

export async function listAudiences(organizationId: string) {
  return prisma.marketingAudience.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveImportedAudience(
  organizationId: string,
  input: { name: string; description?: string; contacts: ImportedContactRow[] },
  createdById?: string,
) {
  if (input.contacts.length === 0) {
    throw new Error("No valid contacts found. Each row needs an email address.");
  }

  const blocked = await blockedMarketingEmails(
    organizationId,
    input.contacts.map((contact) => contact.email),
  );
  const contacts = input.contacts.filter((contact) => !blocked.has(contact.email.trim().toLowerCase()));
  if (contacts.length === 0) {
    throw new Error("No contactable emails remained after DNC and suppression checks.");
  }

  const audience = await prisma.marketingAudience.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description,
      filters: { sourceType: "import" } as Prisma.InputJsonValue,
      estimatedCount: contacts.length,
      createdById,
    },
  });

  await prisma.marketingAudienceContact.createMany({
    data: contacts.map((contact) => ({
      audienceId: audience.id,
      organizationId,
      email: contact.email,
      contactName: contact.contactName,
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title,
      department: contact.department,
      company: contact.company,
    })),
  });

  return audience;
}

export function parseContactsFromUpload(buffer: ArrayBuffer, fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    return parseContactCsv(text);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseContactXlsx(buffer);
  }
  throw new Error("Unsupported file type. Upload a .csv or .xlsx file.");
}

export async function saveAudience(
  organizationId: string,
  input: { name: string; description?: string; filters: AudienceFilters },
  createdById?: string,
) {
  const estimatedCount = await countAudience(organizationId, input.filters);
  return prisma.marketingAudience.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description,
      filters: { ...input.filters, sourceType: input.filters.sourceType ?? "candidates" } as Prisma.InputJsonValue,
      estimatedCount,
      createdById,
    },
  });
}

/** Snapshot selected ATS candidates into an isolated marketing audience. */
export async function importCandidatesToMarketingAudience(
  organizationId: string,
  input: { name: string; description?: string; candidateIds: string[] },
  createdById?: string,
) {
  const uniqueIds = [...new Set(input.candidateIds)];
  if (uniqueIds.length === 0) throw new Error("Select at least one candidate");

  const suppressed = await prisma.marketingSuppression.findMany({
    where: { organizationId },
    select: { email: true },
  });
  const blocked = new Set(suppressed.map((row) => row.email.toLowerCase()));

  const candidates = await prisma.candidate.findMany({
    where: {
      organizationId,
      deletedAt: null,
      doNotContact: false,
      id: { in: uniqueIds },
      email: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      currentRole: true,
      currentCompany: true,
    },
  });

  const contacts = candidates.filter(
    (candidate) => candidate.email && !blocked.has(candidate.email.toLowerCase()),
  );
  if (contacts.length === 0) {
    throw new Error("No contactable candidates with email addresses were available to import");
  }

  const audience = await prisma.marketingAudience.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description ?? "Imported from candidate database",
      filters: {
        sourceType: "import",
        importedFrom: "candidate_database",
        candidateIds: contacts.map((candidate) => candidate.id),
      } as Prisma.InputJsonValue,
      estimatedCount: contacts.length,
      createdById,
    },
  });

  await prisma.marketingAudienceContact.createMany({
    data: contacts.map((candidate) => ({
      audienceId: audience.id,
      organizationId,
      email: candidate.email!.toLowerCase(),
      contactName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      title: candidate.currentRole ?? undefined,
      company: candidate.currentCompany ?? undefined,
    })),
    skipDuplicates: true,
  });

  return audience;
}

export async function updateAudienceCount(audienceId: string, organizationId: string) {
  const audience = await prisma.marketingAudience.findFirst({
    where: { id: audienceId, organizationId },
  });
  if (!audience) return null;
  const filters = audience.filters as AudienceFilters;
  const estimatedCount = await countAudience(organizationId, filters, audienceId);
  return prisma.marketingAudience.update({
    where: { id: audienceId },
    data: { estimatedCount },
  });
}
