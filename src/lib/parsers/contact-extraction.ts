import { extractLocation, extractWorkAuthorization } from "./location-extraction";
import {
  inferPhoneCountryCode as inferDialCodeFromContext,
  splitPhoneForStorage,
} from "@/lib/format-phone";
import {
  classifyEmail,
  detectPortfolioUrl,
  detectProfessionalProfiles,
  extractAllEmails,
  extractAllPhones,
  inferNameFromResumeFileName,
  isValidName,
  looksLikePersonName,
  normalizeEmail,
  normalizeGitHubUrl,
  normalizeLinkedInUrl,
  normalizePhone,
  normalizeWhitespace,
  parseNameParts,
  stripNameTitles,
  titleCasePersonName,
} from "./contact-normalize";
import type {
  ContactField,
  ContactParserDiagnostics,
  ContactQuality,
  ParsedAvailability,
  ParsedContactInfo,
  ParsedEmailEntry,
  ParsedName,
  ParsedPhoneEntry,
  ParsedProfileLink,
  ParsedWorkAuthorization,
} from "./contact-types";
import { PARSER_VERSION } from "./contact-types";
import { sanitizeCandidateEmail, sanitizeCandidateLocation } from "@/lib/sanitize-contact";

function field<T>(
  value: T,
  confidence: number,
  source: string,
  opts?: { normalized?: boolean; validated?: boolean; raw?: string; line?: number }
): ContactField<T> {
  return {
    value,
    confidence,
    source,
    normalized: opts?.normalized ?? false,
    validated: opts?.validated ?? false,
    raw: opts?.raw,
    line: opts?.line,
  };
}

const CONTACT_LABEL_SPLIT =
  /\s*\b(?:e-?mails?|emailid|mail\s*id|mails?\s*id|phone(?:\s*(?:no\.?|number))?|mobile(?:\s*(?:no\.?|number))?|contact(?:\s*(?:no\.?|number))?|tel(?:ephone)?|linkedin|github)\b\s*:?\s*/i;

const GLUED_CONTACT_LABEL =
  /(?<=[A-Za-z.])(?=(?:Emailid|E-?mail|Phone|Mobile|Contact|LinkedIn|Github)\b)/i;

const TRAILING_TITLE =
  /(?:\s+(?:sr\.?|senior|jr\.?|junior|lead|principal|staff|associate))?(?:\s+(?:dev\s*ops|devops|data|cloud|software|java|python|react(?:js)?|frontend|front\s*end|backend|full\s*stack|etl|sre|ai\/?ml))*\s+(?:engineer|developer|analyst|architect|consultant|manager|specialist|administrator|scientist|intern|coordinator|operator)\b.*$/i;

function peelNameCandidate(line: string): string {
  let value = normalizeWhitespace(line);
  if (!value) return "";

  const labeled = value.match(
    /(?:^|[\s|])(?:candidate(?:['’]s)?\s+(?:full\s+legal\s+)?name|full\s+name|candidate\s+name|name)\s*:?\s*(.*)$/i,
  );
  if (labeled) value = labeled[1] ?? "";

  value = value.replace(GLUED_CONTACT_LABEL, " ");
  value = value.replace(/([A-Za-z])(\d)/g, "$1 $2");
  value = value.split(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)[0] ?? "";
  value = value.split(CONTACT_LABEL_SPLIT)[0] ?? "";
  value = value.replace(/https?:\/\/\S+/gi, " ");
  value = value.replace(/\b(?:linkedin|github)\.com\/\S+/gi, " ");
  value = value.replace(/\+?\d[\d\s().-]{8,}\d/g, " ");
  value = value.replace(/[|]+/g, " ");
  value = value.replace(TRAILING_TITLE, " ");
  value = stripNameTitles(value);
  return normalizeWhitespace(value);
}

const NAME_LABEL =
  /(?:candidate(?:['’]s)?\s+(?:full\s+legal\s+)?name|full\s+name|candidate\s+name|name)\s*:/i;
const NAME_LABEL_ONLY =
  /^(?:candidate(?:['’]s)?\s+(?:full\s+legal\s+)?name|full\s+name|candidate\s+name|name)\s*:?\s*$/i;
const EMAIL_LABEL =
  /(?:e-?mail(?:\s*(?:id|address))?|emailid|mail\s*id)\s*:?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
const PHONE_LABEL = /\b(?:phone|mobile|tel(?:ephone)?|contact)\b/i;
const JOB_PHONE_LINE = /\b(?:duration|project\s*#|organization)\s*:/i;

function lastNameFromEmail(firstName: string, text: string): string | undefined {
  const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
  if (first.length < 2) return undefined;
  for (const email of extractAllEmails(text)) {
    const local = (email.split("@")[0] ?? "").toLowerCase();
    const separator = local.includes(".") ? "." : local.includes("_") ? "_" : null;
    if (!separator) continue;
    const tokens = local
      .split(separator)
      .map((token) => token.replace(/[0-9]+/g, ""))
      .filter((token) => /^[a-z]{2,20}$/.test(token));
    if (tokens.length < 2) continue;
    if (tokens[0] !== first && !tokens[0].startsWith(first)) continue;
    const last = tokens[tokens.length - 1];
    if (!last || last === first) continue;
    if (["engineer", "developer", "gmail", "mail", "email"].includes(last)) continue;
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return undefined;
}

function namePartsFromLine(line: string, allowSingleToken = false) {
  const peeled = peelNameCandidate(line);
  if (!peeled || !looksLikePersonName(peeled)) return null;
  const tokenCount = peeled.split(/\s+/).filter(Boolean).length;
  const labeled = NAME_LABEL.test(line);
  const titleLeftover = tokenCount < 2 && TRAILING_TITLE.test(normalizeWhitespace(line));
  if (titleLeftover) return null;
  if (tokenCount < 2 && !labeled && !allowSingleToken) return null;
  return parseNameParts(titleCasePersonName(peeled));
}

function detectHeader(lines: string[]): boolean {
  const header = lines.slice(0, 8).join(" ").toLowerCase();
  return (
    header.includes("@") ||
    /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(header) ||
    header.includes("linkedin")
  );
}

function extractNameFromText(
  text: string,
  fileName?: string,
): { name: ParsedName; line?: number } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const name: ParsedName = {};
  let parts: ReturnType<typeof parseNameParts> = null;
  let lineNo: number | undefined;
  let source = "Resume Header";
  const headerBlob = lines.slice(0, 8).join(" ").toLowerCase();
  const unlabeledNamesUnsafe = /hiring manager|rejection cause|role prep status|audit details/.test(
    headerBlob,
  );

  const take = (next: NonNullable<ReturnType<typeof parseNameParts>>, index: number, from: string) => {
    parts = next;
    lineNo = index + 1;
    source = from;
  };

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i];
    if (NAME_LABEL_ONLY.test(line) && i + 1 < lines.length) {
      const fromNext = namePartsFromLine(lines[i + 1], true);
      if (fromNext) {
        take(fromNext, i + 1, "Resume Header");
        break;
      }
    }
    if (NAME_LABEL.test(line)) {
      const fromLine = namePartsFromLine(line, true);
      if (fromLine) {
        take(fromLine, i, i < 12 ? "Resume Header" : "Resume Body");
        break;
      }
    }
  }

  if (!parts) {
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      if (unlabeledNamesUnsafe) break;
      const fromLine = namePartsFromLine(lines[i], i === 0);
      if (fromLine) {
        take(fromLine, i, i < 3 ? "Resume Header" : "Resume Body");
        break;
      }
    }
  }

  if (!parts) {
    parts = inferNameFromResumeFileName(fileName);
    if (parts) {
      source = "File Name";
    }
  }

  if (!parts) return { name };

  if (!parts.last_name && parts.first_name) {
    const inferredLast = lastNameFromEmail(parts.first_name, text);
    if (inferredLast) {
      parts = {
        ...parts,
        last_name: inferredLast,
        full_name: `${parts.first_name} ${inferredLast}`,
      };
    }
  }

  const confidence = source === "File Name" ? 55 : lineNo && lineNo <= 3 ? 95 : Math.max(60, 95 - (lineNo ?? 8) * 5);

  name.full_name = field(parts.full_name, confidence, source, {
    normalized: true,
    validated: isValidName(parts.full_name),
    raw: parts.full_name,
    line: lineNo,
  });
  if (parts.prefix) {
    name.prefix = field(parts.prefix, confidence - 5, source, { line: lineNo });
  }
  if (parts.first_name) {
    name.first_name = field(parts.first_name, confidence, source, {
      normalized: true,
      validated: true,
      line: lineNo,
    });
  }
  if (parts.middle_name) {
    name.middle_name = field(parts.middle_name, confidence - 5, source, { line: lineNo });
  }
  if (parts.last_name) {
    name.last_name = field(parts.last_name, confidence, source, {
      normalized: true,
      validated: true,
      line: lineNo,
    });
  }
  if (parts.suffix) {
    name.suffix = field(parts.suffix, confidence - 5, source, { line: lineNo });
  }
  if (parts.preferred_name) {
    name.preferred_name = field(parts.preferred_name, confidence - 5, source, { line: lineNo });
  }
  return { name, line: lineNo };
}

function headerLines(text: string, count = 12): string {
  return text.split(/\n/).slice(0, count).join("\n");
}

function labeledHeaderEmail(text: string): string | undefined {
  const match = headerLines(text).match(EMAIL_LABEL);
  return match?.[1] ? normalizeEmail(match[1]) ?? undefined : undefined;
}

function emailRank(entry: ParsedEmailEntry, labeled?: string): number {
  let score = 0;
  if (labeled && entry.value.toLowerCase() === labeled.toLowerCase()) score += 1000;
  if (entry.source === "Resume Header") score += 200;
  if (!entry.is_corporate && !entry.is_disposable) score += 150;
  if (entry.is_disposable) score -= 80;
  return score + entry.confidence;
}

function extractEmails(text: string, headerDetected: boolean): ParsedEmailEntry[] {
  const rawEmails = extractAllEmails(text);
  const header = headerLines(text);
  const labeled = labeledHeaderEmail(text);
  const entries: ParsedEmailEntry[] = [];

  for (let i = 0; i < rawEmails.length; i++) {
    const normalized = normalizeEmail(rawEmails[i]);
    if (!normalized) continue;
    const classification = classifyEmail(normalized);
    const inHeader = header.toLowerCase().includes(normalized.toLowerCase());
    const confidence = inHeader && headerDetected ? 95 : 75 - i * 5;
    const flags: string[] = [];
    if (classification.is_disposable) flags.push("Disposable Email");
    if (classification.is_corporate) flags.push("Corporate Email");
    if (classification.is_educational) flags.push("Education Email");
    if (i > 0) flags.push("Multiple Emails");

    entries.push({
      value: normalized,
      confidence,
      source: inHeader ? "Resume Header" : "Resume Body",
      normalized: true,
      validated: true,
      is_primary: false,
      flags,
      ...classification,
    });
  }

  if (entries.length === 0) {
    return [];
  }

  entries.sort((a, b) => emailRank(b, labeled) - emailRank(a, labeled));
  entries.forEach((entry, index) => {
    entry.is_primary = index === 0;
  });

  return entries;
}

function phoneContext(text: string, raw: string): { line: string; index: number } | undefined {
  const digits = raw.replace(/\D/g, "");
  const needle = digits.slice(0, 10);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(/\D/g, "").includes(needle)) {
      return { line: lines[i], index: i };
    }
  }
  return undefined;
}

function shouldSkipPhone(line: string, raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (/^(?:19|20)\d{2}$/.test(digits)) return true;
  if (digits.length === 5) return true;
  if (JOB_PHONE_LINE.test(line)) return true;
  return false;
}

function phoneRank(line: string, index: number, headerDetected: boolean): number {
  let score = 0;
  if (index < 12) score += 200;
  if (PHONE_LABEL.test(line)) score += 400;
  if (headerDetected && index < 12) score += 50;
  return score - index;
}

function extractPhones(text: string, headerDetected: boolean): ParsedPhoneEntry[] {
  const rawPhones = extractAllPhones(text);
  const scored: Array<{ entry: ParsedPhoneEntry; rank: number }> = [];

  for (let i = 0; i < rawPhones.length; i++) {
    const raw = rawPhones[i];
    const parsed = normalizePhone(raw);
    if (!parsed) continue;
    const context = phoneContext(text, raw);
    if (context && shouldSkipPhone(context.line, raw)) continue;
    const inHeader = (context?.index ?? 99) < 12;
    const flags: string[] = [];
    if (i > 0) flags.push("Multiple Phones");
    if (raw.replace(/\D/g, "").length < 10) flags.push("Short Number");

    scored.push({
      rank: phoneRank(context?.line ?? "", context?.index ?? 99, headerDetected),
      entry: {
        value: raw,
        normalized: parsed.normalized,
        confidence: inHeader && headerDetected ? 90 : 70 - i * 5,
        source: inHeader ? "Resume Header" : "Resume Body",
        normalized_field: true,
        validated: true,
        country_code: parsed.country_code,
        area_code: parsed.area_code,
        national_number: parsed.national_number,
        extension: parsed.extension,
        phone_type: "unknown",
        country: parsed.country,
        flags,
      },
    });
  }

  scored.sort((a, b) => b.rank - a.rank);
  return scored.map((item) => item.entry);
}

function extractLinkedIn(text: string): ParsedProfileLink | undefined {
  const matches = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w-]+/gi) ?? [];
  for (const raw of matches) {
    const url = normalizeLinkedInUrl(raw);
    if (!url) continue;
    const username = url.split("/in/")[1];
    return {
      url,
      username,
      platform: "LinkedIn",
      profile_type: "Professional Network",
      confidence: text.slice(0, 800).includes(raw) ? 95 : 80,
      source: "Resume",
      normalized: true,
      validated: true,
    };
  }
  return undefined;
}

function extractGitHub(text: string): ParsedProfileLink | undefined {
  const matches = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/gi) ?? [];
  for (const raw of matches) {
    const url = normalizeGitHubUrl(raw);
    if (!url) continue;
    const username = url.split("github.com/")[1];
    return {
      url,
      username,
      platform: "GitHub",
      profile_type: "Developer",
      confidence: text.slice(0, 800).includes(raw) ? 95 : 80,
      source: "Resume",
      normalized: true,
      validated: true,
    };
  }
  return undefined;
}

function extractPortfolio(text: string): ParsedProfileLink | undefined {
  const detected = detectPortfolioUrl(text);
  if (!detected) return undefined;
  return {
    url: detected.url,
    platform: detected.platform,
    profile_type: detected.type,
    confidence: 75,
    source: "Resume",
    normalized: true,
    validated: true,
  };
}

function extractProfessionalProfiles(text: string): ParsedProfileLink[] {
  return detectProfessionalProfiles(text).map((p) => ({
    url: p.url,
    username: p.username,
    platform: p.platform,
    profile_type: p.type,
    confidence: 70,
    source: "Resume",
    normalized: true,
    validated: true,
  }));
}

function extractStructuredWorkAuth(text: string): ParsedWorkAuthorization {
  const label = extractWorkAuthorization(text);
  const labels: string[] = [];
  if (label) labels.push(label);

  const patterns: Array<{ regex: RegExp; label: string; key?: keyof ParsedWorkAuthorization }> = [
    { regex: /\bU\.?S\.?\s+Citizen\b/i, label: "US Citizen" },
    { regex: /\bGreen Card\b|\bPermanent Resident\b/i, label: "Green Card" },
    { regex: /\bH-?1B\b/i, label: "H1B" },
    { regex: /\bH-?4\s*EAD\b/i, label: "H4 EAD" },
    { regex: /\bOPT\b/i, label: "OPT" },
    { regex: /\bCPT\b/i, label: "CPT" },
    { regex: /\bTN Visa\b/i, label: "TN Visa" },
    { regex: /\bRequires Sponsorship\b/i, label: "Requires Sponsorship" },
    { regex: /\bAuthorized to Work\b|\bNo Sponsorship Required\b/i, label: "Authorized to Work" },
    { regex: /\bSecurity Clearance\b/i, label: "Security Clearance" },
    { regex: /\bEAD\b/i, label: "EAD" },
  ];

  for (const { regex, label: l } of patterns) {
    if (regex.test(text) && !labels.includes(l)) labels.push(l);
  }

  const requires_sponsorship = /\bRequires Sponsorship\b/i.test(text);
  const authorized_to_work =
    /\bAuthorized to Work\b|\bNo Sponsorship Required\b|\bU\.?S\.?\s+Citizen\b|\bGreen Card\b|\bPermanent Resident\b/i.test(
      text
    );
  const securityMatch = text.match(/\b(?:Security Clearance|Clearance)[:\s]+([\w\s/]+)/i);

  return {
    status: labels[0],
    requires_sponsorship,
    authorized_to_work,
    security_clearance: securityMatch?.[1]?.trim(),
    labels,
    confidence: labels.length > 0 ? 80 : 0,
  };
}

function extractAvailability(text: string): ParsedAvailability {
  const noticeMatch = text.match(
    /(?:notice period|availability)[:\s]*(\d+\s*(?:weeks?|months?|days?)|immediate)/i
  );
  const immediate = /\b(?:immediate(?:ly)?|available now|immediate start)\b/i.test(text);
  const actively_looking = /\b(?:actively looking|seeking new|open to new opportunities)\b/i.test(text);
  const open_to_opportunities = /\bopen to opportunities\b/i.test(text);
  const availableFrom = text.match(/(?:available from|start date)[:\s]*([\w\s,]+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);

  return {
    immediate,
    notice_period: noticeMatch?.[1],
    available_from: availableFrom?.[1]?.trim(),
    actively_looking,
    open_to_opportunities,
    confidence: immediate || noticeMatch ? 70 : 0,
  };
}

function computeQuality(
  contact: Omit<ParsedContactInfo, "quality" | "search_tokens" | "parser">
): ContactQuality {
  const checks = [
    contact.emails.length > 0,
    contact.phones.length > 0,
    !!contact.linkedin,
    !!contact.github,
    !!contact.portfolio,
    !!(contact.address.city?.value || contact.address.country?.value || contact.address.full_address),
  ];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  let qualityPoints = 0;
  const primaryEmail = contact.emails.find((e) => e.is_primary) ?? contact.emails[0];
  if (primaryEmail?.is_corporate) qualityPoints += 25;
  else if (primaryEmail) qualityPoints += 10;
  if (contact.linkedin?.validated) qualityPoints += 20;
  if (contact.portfolio?.validated) qualityPoints += 20;
  if (contact.github?.validated) qualityPoints += 15;
  const methodCount = [
    contact.emails.length > 0,
    contact.phones.length > 0,
    !!contact.linkedin,
    !!contact.github,
    !!contact.portfolio,
  ].filter(Boolean).length;
  if (methodCount >= 3) qualityPoints += 20;

  const fieldConfidences = [
    contact.name.full_name?.confidence,
    primaryEmail?.confidence,
    contact.phones[0]?.confidence,
    contact.linkedin?.confidence,
    contact.github?.confidence,
  ].filter((c): c is number => c !== undefined);
  const overall =
    fieldConfidences.length > 0
      ? Math.round(fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length)
      : 0;

  const duplicateSignals = [
    contact.emails.length > 1,
    contact.phones.length > 1,
  ].filter(Boolean).length;

  return {
    contact_completeness_score: completeness,
    contact_quality_score: Math.min(100, qualityPoints),
    overall_confidence: overall,
    duplicate_probability: duplicateSignals * 15,
  };
}

function buildSearchTokens(
  contact: Omit<ParsedContactInfo, "quality" | "search_tokens" | "parser">
): string[] {
  const tokens = new Set<string>();
  if (contact.name.full_name?.value) tokens.add(contact.name.full_name.value);
  if (contact.name.first_name?.value && contact.name.last_name?.value) {
    tokens.add(`${contact.name.first_name.value} ${contact.name.last_name.value}`);
  }
  for (const email of contact.emails) {
    tokens.add(email.value);
    tokens.add(`email:${email.username}`);
  }
  for (const phone of contact.phones) {
    if (phone.normalized) tokens.add(phone.normalized);
  }
  if (contact.linkedin?.username) tokens.add(`linkedin:${contact.linkedin.username}`);
  if (contact.github?.username) tokens.add(`github:${contact.github.username}`);
  if (contact.portfolio?.url) {
    try {
      tokens.add(new URL(contact.portfolio.url).hostname);
    } catch {
      tokens.add(contact.portfolio.url);
    }
  }
  if (contact.address.city?.value) tokens.add(contact.address.city.value);
  if (contact.address.state?.value) tokens.add(contact.address.state.value);
  if (contact.address.country?.value) tokens.add(contact.address.country.value);
  return [...tokens];
}

export interface ExtractContactOptions {
  resumeType?: ContactParserDiagnostics["resume_type"];
  ocrUsed?: boolean;
  scannedPdf?: boolean;
  fileName?: string;
}

export function extractContactInfo(
  rawText: string,
  options: ExtractContactOptions = {}
): ParsedContactInfo {
  const start = Date.now();
  const lines = rawText.split("\n").map((l) => normalizeWhitespace(l)).filter(Boolean);
  const headerDetected = detectHeader(lines);
  const warnings: string[] = [];

  const { name } = extractNameFromText(rawText, options.fileName);
  if (!name.first_name) warnings.push("Name not detected in header");

  const emails = extractEmails(rawText, headerDetected);
  if (emails.length === 0) warnings.push("Missing Email");

  const phones = extractPhones(rawText, headerDetected);
  if (phones.length === 0) warnings.push("Missing Phone");

  const linkedin = extractLinkedIn(rawText);
  const github = extractGitHub(rawText);
  const portfolio = extractPortfolio(rawText);
  const professional_profiles = extractProfessionalProfiles(rawText);

  const loc = extractLocation(rawText);
  const address = {
    city: loc.city ? field(loc.city, 80, "Resume Header", { validated: true }) : undefined,
    state: loc.state ? field(loc.state, 80, "Resume Header", { validated: true }) : undefined,
    zip: loc.zipCode ? field(loc.zipCode, 75, "Resume Header", { validated: true }) : undefined,
    country: loc.country ? field(loc.country, 80, "Resume Header", { validated: true }) : undefined,
    full_address: loc.fullAddress,
    flags: !loc.city && !loc.country ? ["Missing"] : !loc.city || !loc.country ? ["Incomplete"] : [],
  };

  const enrichedPhones = phones.map((phone, index) => {
    if (index !== 0) return phone;
    const inferred = inferDialCodeFromContext(phone, address.country?.value);
    if (!inferred.country_code) return phone;
    return {
      ...phone,
      country_code: inferred.country_code,
      country: inferred.country ?? phone.country,
      flags: [...(phone.flags ?? []), "Country code inferred from location"],
    };
  });

  const work_authorization = extractStructuredWorkAuth(rawText);
  const availability = extractAvailability(rawText);

  const partial: Omit<ParsedContactInfo, "quality" | "search_tokens" | "parser"> = {
    name,
    emails,
    phones: enrichedPhones,
    linkedin,
    github,
    portfolio,
    professional_profiles,
    address,
    work_authorization,
    availability,
  };

  const quality = computeQuality(partial);
  const search_tokens = buildSearchTokens(partial);

  const parser: ContactParserDiagnostics = {
    header_detected: headerDetected,
    resume_type: options.resumeType ?? "UNKNOWN",
    ocr_used: options.ocrUsed ?? false,
    columns_detected: /\t|\s{4,}/.test(rawText.slice(0, 2000)),
    tables_detected: /\|/.test(rawText.slice(0, 5000)),
    images_present: false,
    scanned_pdf: options.scannedPdf ?? false,
    parse_time_ms: Date.now() - start,
    parser_version: PARSER_VERSION,
    warnings,
  };

  return { ...partial, quality, search_tokens, parser };
}

/** Map enterprise contact schema back to flat ParsedResumeResult fields */
export function flattenContactFields(contact: ParsedContactInfo) {
  const primaryEmail = contact.emails.find((e) => e.is_primary) ?? contact.emails[0];
  const primaryPhone = contact.phones[0];
  const phoneFields = splitPhoneForStorage(primaryPhone);
  const locationParts = [
    contact.address.city?.value,
    contact.address.state?.value,
    contact.address.country?.value,
  ].filter(Boolean);

  return {
    firstName: contact.name.first_name?.value,
    lastName: contact.name.last_name?.value,
    email: sanitizeCandidateEmail(primaryEmail?.value),
    phone: phoneFields.phone,
    phoneCountryCode: phoneFields.phoneCountryCode,
    linkedIn: contact.linkedin?.url,
    githubUrl: contact.github?.url,
    portfolioUrl: contact.portfolio?.url,
    website: contact.portfolio?.url,
    city: contact.address.city?.value,
    state: contact.address.state?.value,
    country: contact.address.country?.value,
    zipCode: contact.address.zip?.value,
    location:
      locationParts.length > 0
        ? sanitizeCandidateLocation(locationParts.join(", "))
        : sanitizeCandidateLocation(contact.address.full_address),
    workAuthorization: contact.work_authorization.status ?? contact.work_authorization.labels[0],
    availability: contact.availability.notice_period
      ? contact.availability.immediate
        ? "Immediate"
        : contact.availability.notice_period
      : contact.availability.immediate
        ? "Immediate"
        : undefined,
  };
}

/** Backward-compatible single-value extractors */
export function extractEmail(text: string): string | undefined {
  const emails = extractEmails(text, detectHeader(text.split("\n").map((l) => l.trim()).filter(Boolean)));
  return emails.find((e) => e.is_primary)?.value ?? emails[0]?.value;
}

export function extractPhone(text: string): string | undefined {
  const phones = extractPhones(text, detectHeader(text.split("\n").map((l) => l.trim()).filter(Boolean)));
  return phones[0]?.normalized ?? phones[0]?.value;
}

export function extractName(text: string, fileName?: string): {
  firstName?: string;
  lastName?: string;
  fullName?: string;
} {
  const { name } = extractNameFromText(text, fileName);
  return {
    firstName: name.first_name?.value,
    lastName: name.last_name?.value,
    fullName: name.full_name?.value,
  };
}
