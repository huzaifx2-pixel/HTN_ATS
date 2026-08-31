import { prisma } from "@/lib/db";

export class ContactBlockedError extends Error {
  constructor(message = "This contact is marked Do Not Contact.") {
    super(message);
    this.name = "ContactBlockedError";
  }
}

export async function getCandidateContactStatus(candidateId: string, organizationId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
    select: { id: true, email: true, doNotContact: true, doNotContactAt: true },
  });
  if (!candidate) return null;

  const suppressed =
    candidate.email &&
    (await prisma.marketingSuppression.findFirst({
      where: {
        organizationId,
        email: { equals: candidate.email, mode: "insensitive" },
      },
      select: { id: true },
    }));

  return {
    candidateId: candidate.id,
    email: candidate.email,
    doNotContact: candidate.doNotContact || Boolean(suppressed),
    doNotContactAt: candidate.doNotContactAt,
    marketingSuppressed: Boolean(suppressed),
  };
}

export async function assertCandidateCanBeContacted(candidateId: string, organizationId: string) {
  const status = await getCandidateContactStatus(candidateId, organizationId);
  if (!status) throw new Error("Candidate not found");
  if (status.doNotContact) {
    throw new ContactBlockedError();
  }
  return status;
}

export async function assertEmailCanBeContacted(email: string, organizationId: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const [candidate, suppressed] = await Promise.all([
    prisma.candidate.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        email: { equals: normalized, mode: "insensitive" },
      },
      select: { doNotContact: true },
    }),
    prisma.marketingSuppression.findFirst({
      where: { organizationId, email: { equals: normalized, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);

  if (candidate?.doNotContact || suppressed) {
    throw new ContactBlockedError();
  }
}

export async function setCandidateDoNotContact(
  candidateId: string,
  organizationId: string,
  doNotContact: boolean,
) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      doNotContact,
      doNotContactAt: doNotContact ? new Date() : null,
    },
  });

  if (doNotContact && candidate.email) {
    await prisma.marketingSuppression.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email: candidate.email.toLowerCase(),
        },
      },
      create: {
        organizationId,
        email: candidate.email.toLowerCase(),
        reason: "do_not_contact",
      },
      update: {
        reason: "do_not_contact",
      },
    });
  }

  return { doNotContact };
}

export async function bulkSetCandidateDoNotContact(
  candidateIds: string[],
  organizationId: string,
  doNotContact: boolean,
) {
  let updated = 0;
  for (const candidateId of candidateIds) {
    await setCandidateDoNotContact(candidateId, organizationId, doNotContact);
    updated += 1;
  }
  return { updated };
}

export async function blockedMarketingEmails(organizationId: string, emails: string[]) {
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return new Set<string>();

  const [suppressed, dnc] = await Promise.all([
    prisma.marketingSuppression.findMany({
      where: { organizationId, email: { in: normalized } },
      select: { email: true },
    }),
    prisma.candidate.findMany({
      where: {
        organizationId,
        deletedAt: null,
        doNotContact: true,
        OR: [{ normalizedEmail: { in: normalized } }, { email: { in: normalized, mode: "insensitive" } }],
      },
      select: { email: true, normalizedEmail: true },
    }),
  ]);

  const blocked = new Set(suppressed.map((row) => row.email.toLowerCase()));
  for (const candidate of dnc) {
    if (candidate.normalizedEmail) blocked.add(candidate.normalizedEmail);
    if (candidate.email) blocked.add(candidate.email.toLowerCase());
  }
  return blocked;
}
