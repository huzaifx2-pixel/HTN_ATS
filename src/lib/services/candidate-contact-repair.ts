import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  sanitizeCandidateEmail,
  sanitizeCandidateCity,
  sanitizeCandidateLocation,
} from "@/lib/sanitize-contact";

const LIKELY_CORRUPT_CONTACT: Prisma.CandidateWhereInput = {
  OR: [
    { email: { contains: " " } },
    { email: { contains: "Phone" } },
    { email: { contains: ":" } },
    { location: { contains: "@" } },
    { location: { contains: "experience" } },
    { city: { contains: "experience" } },
  ],
};

async function applyContactSanitization(
  candidates: Array<{
    id: string;
    email: string | null;
    location: string | null;
    city: string | null;
  }>,
) {
  let repaired = 0;
  for (const candidate of candidates) {
    const email = sanitizeCandidateEmail(candidate.email) ?? null;
    const location = sanitizeCandidateLocation(candidate.location) ?? null;
    const city = sanitizeCandidateCity(candidate.city) ?? null;

    const changed =
      (candidate.email ?? null) !== email ||
      (candidate.location ?? null) !== location ||
      (candidate.city ?? null) !== city;

    if (!changed) continue;

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { email, location, city },
    });
    repaired += 1;
  }
  return repaired;
}

export async function repairCandidateRecord(candidate: {
  id: string;
  email: string | null;
  location: string | null;
  city: string | null;
}) {
  return applyContactSanitization([candidate]);
}

export async function repairCandidateContacts(candidateId: string, organizationId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId },
    select: { id: true, email: true, location: true, city: true },
  });
  if (!candidate) return 0;
  return repairCandidateRecord(candidate);
}

/** Clean corrupted email/location values stored by older parsers. */
export async function repairOrganizationCandidateContacts(organizationId: string) {
  const candidates = await prisma.candidate.findMany({
    where: { organizationId, deletedAt: null, ...LIKELY_CORRUPT_CONTACT },
    select: { id: true, email: true, location: true, city: true, country: true },
    take: 500,
  });

  return applyContactSanitization(candidates);
}

export async function repairAllCandidateContacts() {
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  let repaired = 0;
  for (const organization of organizations) {
    repaired += await repairOrganizationCandidateContacts(organization.id);
  }
  return repaired;
}
