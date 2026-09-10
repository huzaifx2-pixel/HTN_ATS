import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  sanitizeCandidateEmail,
  sanitizeCandidateCity,
  sanitizeCandidateLocation,
} from "@/lib/sanitize-contact";
import { extractContactInfo, flattenContactFields } from "@/lib/parsers/contact-extraction";
import {
  isPlaceholderPersonName,
  parseOverrideKeys,
  resolvedParsedIdentity,
} from "@/lib/parsers/candidate-fields";
import { normalizeEmail, normalizePhone } from "@/lib/identity/normalize";

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

const NEEDS_CONTACT_REPAIR: Prisma.CandidateWhereInput = {
  OR: [
    { firstName: { equals: "Unknown", mode: "insensitive" } },
    { email: null },
    { phone: null },
    { location: null },
    LIKELY_CORRUPT_CONTACT,
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
  const fromRaw = await repairCandidateContactFromRawText(candidateId, organizationId);
  if (fromRaw > 0) return fromRaw;
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

function needsEmailRepair(email: string | null): boolean {
  if (!email?.trim()) return true;
  return !sanitizeCandidateEmail(email);
}

function needsLocationRepair(location: string | null, city: string | null): boolean {
  if (!location?.trim() && !city?.trim()) return true;
  if (location && !sanitizeCandidateLocation(location)) return true;
  if (city && !sanitizeCandidateCity(city)) return true;
  return false;
}

type RepairTarget = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  metadata: Prisma.JsonValue;
  parsedResume: { rawText: string | null } | null;
  documents: Array<{ fileName: string }>;
};

function contactPatchFromRawText(candidate: RepairTarget): Prisma.CandidateUpdateInput | null {
  const rawText = candidate.parsedResume?.rawText?.trim();
  if (!rawText) return null;

  const overrides = parseOverrideKeys(candidate.metadata);
  const fileName = candidate.documents[0]?.fileName;
  const flat = flattenContactFields(extractContactInfo(rawText, { fileName }));
  const identity = resolvedParsedIdentity(flat, fileName);
  const data: Prisma.CandidateUpdateInput = {};

  if (
    !overrides.has("firstName") &&
    !overrides.has("lastName") &&
    isPlaceholderPersonName(candidate.firstName, candidate.lastName) &&
    !isPlaceholderPersonName(identity.firstName, identity.lastName)
  ) {
    data.firstName = identity.firstName;
    data.lastName = identity.lastName;
  }

  if (!overrides.has("email") && needsEmailRepair(candidate.email) && flat.email) {
    data.email = flat.email;
  }

  if (!overrides.has("phone") && !candidate.phone?.trim() && flat.phone) {
    data.phone = flat.phone;
    if (flat.phoneCountryCode) data.phoneCountryCode = flat.phoneCountryCode;
  }

  if (
    !overrides.has("location") &&
    !overrides.has("city") &&
    !overrides.has("country") &&
    needsLocationRepair(candidate.location, candidate.city)
  ) {
    if (flat.location) data.location = flat.location;
    if (flat.city) data.city = flat.city;
    if (flat.country) data.country = flat.country;
  }

  if (Object.keys(data).length === 0) return null;

  if (typeof data.email === "string") {
    data.normalizedEmail = normalizeEmail(data.email);
  }
  if (typeof data.phone === "string") {
    data.normalizedPhone = normalizePhone(data.phone);
  }
  return data;
}

const RAW_TEXT_SELECT = {
  id: true,
  organizationId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  phoneCountryCode: true,
  location: true,
  city: true,
  country: true,
  metadata: true,
  parsedResume: { select: { rawText: true } },
  documents: {
    where: { type: "RESUME" as const, isLatest: true },
    select: { fileName: true },
    take: 1,
    orderBy: { version: "desc" as const },
  },
} satisfies Prisma.CandidateSelect;

async function applyContactPatch(candidate: RepairTarget): Promise<boolean> {
  const data = contactPatchFromRawText(candidate);
  if (!data) return false;

  if (typeof data.email === "string") {
    const normalized = normalizeEmail(data.email);
    if (normalized) {
      const duplicate = await prisma.candidate.findFirst({
        where: {
          organizationId: candidate.organizationId,
          normalizedEmail: normalized,
          deletedAt: null,
          NOT: { id: candidate.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        delete data.email;
        delete data.normalizedEmail;
      }
    }
  }

  const remaining = { ...data };
  delete remaining.normalizedEmail;
  delete remaining.normalizedPhone;
  if (Object.keys(remaining).length === 0) return false;

  try {
    await prisma.candidate.update({ where: { id: candidate.id }, data });
    return true;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2002") return false;
    throw error;
  }
}

export async function repairCandidateContactFromRawText(candidateId: string, organizationId?: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, deletedAt: null, ...(organizationId ? { organizationId } : {}) },
    select: RAW_TEXT_SELECT,
  });
  if (!candidate) return 0;
  return (await applyContactPatch(candidate)) ? 1 : 0;
}

export async function repairOrganizationContactsFromRawText(organizationId: string, take = 500) {
  let repaired = 0;
  let cursor: string | undefined;
  const pageSize = 100;

  while (repaired < take) {
    const limit = Math.min(pageSize, take - repaired);
    const candidates = await prisma.candidate.findMany({
      where: {
        organizationId,
        deletedAt: null,
        parsedResume: { rawText: { not: null } },
        ...NEEDS_CONTACT_REPAIR,
      },
      select: RAW_TEXT_SELECT,
      orderBy: { id: "asc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (candidates.length === 0) break;

    for (const candidate of candidates) {
      if (await applyContactPatch(candidate)) repaired += 1;
    }
    cursor = candidates[candidates.length - 1]?.id;
    if (candidates.length < limit) break;
  }
  return repaired;
}

export async function repairAllContactsFromRawText(takePerOrg = 500) {
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  let repaired = 0;
  for (const organization of organizations) {
    repaired += await repairOrganizationContactsFromRawText(organization.id, takePerOrg);
  }
  return repaired;
}
