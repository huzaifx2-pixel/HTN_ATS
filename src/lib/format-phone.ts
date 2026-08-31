type CandidatePhoneSource = {
  phone?: string | null;
  phoneCountryCode?: string | null;
  country?: string | null;
  metadata?: unknown;
};

function inferDefaultCountryCode(phone?: string | null, country?: string | null): string | undefined {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) return undefined;

  if (country === "India") return "+91";
  if (country === "United States" || country === "Canada") return "+1";
  if (country === "United Kingdom") return "+44";
  if (country === "Australia") return "+61";

  if (digits.length === 10 && /^[2-9]\d{9}$/.test(digits)) {
    return "+1";
  }

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return "+91";
  }

  return undefined;
}

function formatNationalNumber(digits: string): string {
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function normalizePhoneCountryCode(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;
  return `+${digits}`;
}

export function resolvePhoneCountryCode(candidate: CandidatePhoneSource): string | undefined {
  if (candidate.phoneCountryCode) {
    return normalizePhoneCountryCode(candidate.phoneCountryCode);
  }

  const metadata = candidate.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const rootCode = (metadata as Record<string, unknown>).phone_country_code;
    if (typeof rootCode === "string" && rootCode.trim()) {
      return normalizePhoneCountryCode(rootCode);
    }

    const contact = (metadata as Record<string, unknown>).contact;
    if (contact && typeof contact === "object" && !Array.isArray(contact)) {
      const phones = (contact as Record<string, unknown>).phones;
      if (Array.isArray(phones) && phones.length > 0) {
        const first = phones[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
          const code = (first as Record<string, unknown>).country_code;
          if (typeof code === "string" || typeof code === "number") {
            return normalizePhoneCountryCode(String(code));
          }
        }
      }
    }
  }

  const phone = candidate.phone?.trim();
  if (phone?.startsWith("+")) {
    const match = phone.match(/^\+(\d{1,3})/);
    if (match) return `+${match[1]}`;
  }

  return inferDefaultCountryCode(phone, candidate.country);
}

export function formatPhoneDisplay(
  phone?: string | null,
  countryCode?: string | null
): string | undefined {
  if (!phone?.trim()) return undefined;
  const code = normalizePhoneCountryCode(countryCode);
  const digits = phone.replace(/\D/g, "");
  if (!digits) return phone.trim();

  if (code) {
    const codeDigits = code.replace(/\D/g, "");
    const national = digits.startsWith(codeDigits) ? digits.slice(codeDigits.length) : digits;
    return `${code} ${formatNationalNumber(national)}`;
  }

  return formatNationalNumber(digits) || phone.trim();
}

export function formatPhoneTelHref(
  phone?: string | null,
  countryCode?: string | null
): string | undefined {
  const display = formatPhoneDisplay(phone, countryCode);
  if (!display) return undefined;
  return `tel:${display.replace(/\s/g, "")}`;
}

export function splitPhoneForStorage(entry?: {
  value?: string;
  normalized?: string;
  country_code?: string;
  area_code?: string;
  national_number?: string;
}): { phone?: string; phoneCountryCode?: string } {
  if (!entry?.value && !entry?.normalized) return {};

  const phoneCountryCode = entry.country_code
    ? normalizePhoneCountryCode(entry.country_code.startsWith("+") ? entry.country_code : `+${entry.country_code}`)
    : undefined;

  if (entry.area_code && entry.national_number) {
    return {
      phone: `${entry.area_code}${entry.national_number}`,
      phoneCountryCode,
    };
  }

  const digits = (entry.value ?? entry.normalized ?? "").replace(/\D/g, "");
  if (phoneCountryCode && digits.length > 10) {
    const codeDigits = phoneCountryCode.replace(/\D/g, "");
    if (digits.startsWith(codeDigits)) {
      return { phone: digits.slice(codeDigits.length), phoneCountryCode };
    }
  }

  return {
    phone: digits || entry.value?.trim(),
    phoneCountryCode,
  };
}

/** Infer country dial code from address when the phone lacks an explicit prefix */
export function inferPhoneCountryCode(
  phone: {
    value: string;
    country_code?: string;
    area_code?: string;
    national_number?: string;
    country?: string;
  },
  addressCountry?: string
): { country_code?: string; country?: string } {
  const digits = phone.value.replace(/\D/g, "");
  const existing = phone.country_code?.replace(/\D/g, "");
  const country = addressCountry ?? phone.country;

  const looksIndianMobile = digits.length === 10 && /^[6-9]\d{9}$/.test(digits);

  if (looksIndianMobile && (!country || country === "India")) {
    return { country_code: "91", country: "India" };
  }

  if (existing && existing !== "1") {
    return { country_code: existing, country: phone.country };
  }

  if (existing === "1" && looksIndianMobile && country === "India") {
    return { country_code: "91", country: "India" };
  }

  if (existing === "1" && !country) {
    return { country_code: existing, country: phone.country ?? "United States" };
  }

  if (country === "India" && digits.length >= 10) {
    return { country_code: "91", country: "India" };
  }
  if (country === "United States" || country === "Canada") {
    return { country_code: "1", country };
  }
  if (country === "United Kingdom") {
    return { country_code: "44", country: "United Kingdom" };
  }
  if (country === "Australia") {
    return { country_code: "61", country: "Australia" };
  }

  return {};
}

/** Common dial codes for the edit form selector */
export const PHONE_COUNTRY_CODES = [
  { code: "+1", label: "US / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+91", label: "India (+91)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+52", label: "Mexico (+52)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+63", label: "Philippines (+63)" },
  { code: "+62", label: "Indonesia (+62)" },
] as const;
