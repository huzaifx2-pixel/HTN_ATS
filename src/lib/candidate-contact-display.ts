import {
  formatPhoneDisplay,
  formatPhoneTelHref,
  normalizePhoneCountryCode,
  resolvePhoneCountryCode,
} from "@/lib/format-phone";
import {
  sanitizeCandidateEmail,
  sanitizeCandidateLocation,
} from "@/lib/sanitize-contact";
import type { ParsedAddress, ParsedContactInfo } from "@/lib/parsers/contact-types";

export type ContactDisplayItem = {
  value: string;
  href?: string;
};

type CandidateContactSource = {
  email?: string | null;
  altEmail?: string | null;
  phone?: string | null;
  phoneCountryCode?: string | null;
  altPhone?: string | null;
  altPhoneCountryCode?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  metadata?: unknown;
};

function getMetadataContact(metadata: unknown): ParsedContactInfo | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const contact = (metadata as Record<string, unknown>).contact;
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) return undefined;
  return contact as ParsedContactInfo;
}

function phoneEntryValue(entry: {
  value?: string;
  normalized?: string;
  area_code?: string;
  national_number?: string;
}): string | undefined {
  if (entry.area_code && entry.national_number) {
    return `${entry.area_code}${entry.national_number}`;
  }
  return entry.value?.trim() || entry.normalized?.trim();
}

function phoneEntryCountryCode(entry: { country_code?: string | number }): string | undefined {
  if (entry.country_code == null || entry.country_code === "") return undefined;
  const raw = String(entry.country_code);
  return normalizePhoneCountryCode(raw.startsWith("+") ? raw : `+${raw}`);
}

function formatAddress(address?: ParsedAddress, fallback?: CandidateContactSource): string | undefined {
  if (!address && !fallback) return undefined;

  if (address?.full_address?.trim()) {
    const sanitized = sanitizeCandidateLocation(address.full_address.trim());
    if (sanitized) return sanitized;
  }

  const city = address?.city?.value ?? fallback?.city;
  const state = address?.state?.value ?? address?.province;
  const country = address?.country?.value ?? fallback?.country;
  const zip = address?.zip?.value;

  const parts = [city, state, country].filter(Boolean);
  if (parts.length > 0) {
    let label = parts.join(", ");
    if (zip) label += ` ${zip}`;
    return label;
  }

  return undefined;
}

export function getCandidateEmails(candidate: CandidateContactSource): ContactDisplayItem[] {
  const seen = new Set<string>();
  const items: ContactDisplayItem[] = [];

  const add = (email?: string | null) => {
    const value = sanitizeCandidateEmail(email);
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ value, href: `mailto:${value}` });
  };

  add(candidate.email);
  add(candidate.altEmail);

  const contact = getMetadataContact(candidate.metadata);
  for (const entry of contact?.emails ?? []) {
    add(entry.value);
  }

  return items;
}

export function getCandidatePhones(candidate: CandidateContactSource): ContactDisplayItem[] {
  const seen = new Set<string>();
  const items: ContactDisplayItem[] = [];

  const add = (phone?: string | null, countryCode?: string | null) => {
    const trimmed = phone?.trim();
    if (!trimmed) return;

    const resolvedCode =
      normalizePhoneCountryCode(countryCode) ??
      resolvePhoneCountryCode({
        phone: trimmed,
        phoneCountryCode: countryCode,
        country: candidate.country,
        metadata: candidate.metadata,
      });

    const display = formatPhoneDisplay(trimmed, resolvedCode);
    if (!display) return;

    const key = display.replace(/\D/g, "");
    if (!key || seen.has(key)) return;
    seen.add(key);

    items.push({
      value: display,
      href: formatPhoneTelHref(trimmed, resolvedCode),
    });
  };

  add(candidate.phone, candidate.phoneCountryCode);
  add(candidate.altPhone, candidate.altPhoneCountryCode);

  const contact = getMetadataContact(candidate.metadata);
  for (const entry of contact?.phones ?? []) {
    add(phoneEntryValue(entry), phoneEntryCountryCode(entry));
  }

  return items;
}

export function getCandidateLocation(candidate: CandidateContactSource): string | undefined {
  const primary = sanitizeCandidateLocation(candidate.location);
  if (primary) return primary;

  const contact = getMetadataContact(candidate.metadata);
  const fromAddress = formatAddress(contact?.address, candidate);
  if (fromAddress) return fromAddress;

  const parts = [
    sanitizeCandidateLocation(candidate.city),
    sanitizeCandidateLocation(candidate.country),
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");

  return undefined;
}

export type CandidateContactSlots = {
  mainEmail?: string;
  altEmail?: string;
  mainPhoneDisplay?: string;
  mainPhoneRaw?: string | null;
  mainPhoneCountryCode?: string | null;
  mainPhoneHref?: string;
  altPhoneDisplay?: string;
  altPhoneRaw?: string | null;
  altPhoneCountryCode?: string | null;
  altPhoneHref?: string;
};

function phoneSlot(
  candidate: CandidateContactSource,
  phone?: string | null,
  countryCode?: string | null,
) {
  const trimmed = phone?.trim();
  if (!trimmed) return undefined;
  const resolvedCode =
    normalizePhoneCountryCode(countryCode) ??
    resolvePhoneCountryCode({
      phone: trimmed,
      phoneCountryCode: countryCode,
      country: candidate.country,
      metadata: candidate.metadata,
    });
  const display = formatPhoneDisplay(trimmed, resolvedCode);
  if (!display) return undefined;
  return {
    display,
    raw: trimmed,
    countryCode: resolvedCode ?? null,
    href: formatPhoneTelHref(trimmed, resolvedCode),
  };
}

export function getCandidateContactSlots(candidate: CandidateContactSource): CandidateContactSlots {
  const emails = getCandidateEmails(candidate);
  const mainEmail = sanitizeCandidateEmail(candidate.email) ?? emails[0]?.value;
  const altEmail =
    sanitizeCandidateEmail(candidate.altEmail) ??
    emails.find((item) => item.value.toLowerCase() !== mainEmail?.toLowerCase())?.value;

  const phones = getCandidatePhones(candidate);
  const mainPhone =
    phoneSlot(candidate, candidate.phone, candidate.phoneCountryCode) ??
    (phones[0]
      ? {
          display: phones[0].value,
          raw: candidate.phone ?? phones[0].value,
          countryCode: candidate.phoneCountryCode ?? null,
          href: phones[0].href,
        }
      : undefined);

  const altFromColumn = phoneSlot(candidate, candidate.altPhone, candidate.altPhoneCountryCode);
  const altFromList = phones.find(
    (item) => item.value.replace(/\D/g, "") !== (mainPhone?.display ?? "").replace(/\D/g, ""),
  );
  const altPhone =
    altFromColumn ??
    (altFromList
      ? {
          display: altFromList.value,
          raw: candidate.altPhone ?? altFromList.value,
          countryCode: candidate.altPhoneCountryCode ?? null,
          href: altFromList.href,
        }
      : undefined);

  return {
    mainEmail,
    altEmail: altEmail && altEmail.toLowerCase() !== mainEmail?.toLowerCase() ? altEmail : undefined,
    mainPhoneDisplay: mainPhone?.display,
    mainPhoneRaw: mainPhone?.raw,
    mainPhoneCountryCode: mainPhone?.countryCode,
    mainPhoneHref: mainPhone?.href,
    altPhoneDisplay: altPhone?.display,
    altPhoneRaw: altPhone?.raw,
    altPhoneCountryCode: altPhone?.countryCode,
    altPhoneHref: altPhone?.href,
  };
}
