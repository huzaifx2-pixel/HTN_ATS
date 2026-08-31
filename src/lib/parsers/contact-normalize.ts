const NAME_PREFIXES = /^(Dr|Mr|Mrs|Ms|Miss|Prof|Professor)\.?\s+/i;
const NAME_SUFFIXES =
  /(?:,\s*|\s+)(Jr\.?|Sr\.?|II|III|IV|V|Ph\.?D\.?|M\.?D\.?|M\.?B\.?A\.?|M\.?S\.?|B\.?S\.?|Esq\.?|CPA|CFA|PMP)\.?\s*$/i;

const DEGREE_TOKENS =
  /\b(M\.?B\.?A\.?|Ph\.?D\.?|M\.?D\.?|M\.?S\.?|B\.?S\.?|B\.?E\.?|M\.?E\.?|B\.?Tech|M\.?Tech|CPA|CFA|PMP)\b/gi;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
  "yopmail.com",
]);

const EDU_TLD_SUFFIXES = [".edu", ".ac.uk", ".edu.au", ".edu.in"];
const GOV_TLD_SUFFIXES = [".gov", ".gov.uk", ".mil"];

const PUBLIC_EMAIL_PROVIDERS: Record<string, string> = {
  "gmail.com": "Google",
  "googlemail.com": "Google",
  "yahoo.com": "Yahoo",
  "yahoo.co.uk": "Yahoo",
  "hotmail.com": "Microsoft",
  "outlook.com": "Microsoft",
  "live.com": "Microsoft",
  "icloud.com": "Apple",
  "me.com": "Apple",
  "aol.com": "AOL",
  "protonmail.com": "ProtonMail",
  "proton.me": "ProtonMail",
};

import {
  EMAIL_REGEX,
  extractAllEmails,
  normalizeEmail,
} from "@/lib/sanitize-contact";

export { EMAIL_REGEX, extractAllEmails, normalizeEmail };

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripNameTitles(raw: string): string {
  let name = normalizeWhitespace(raw);
  name = name.replace(NAME_PREFIXES, "");
  name = name.replace(NAME_SUFFIXES, "");
  name = name.replace(DEGREE_TOKENS, "").replace(/,\s*$/, "").trim();
  return normalizeWhitespace(name);
}

export function isValidName(value: string): boolean {
  if (!value || value.length > 80) return false;
  if (/\d/.test(value)) return false;
  if (value.includes("@")) return false;
  if (!/[a-zA-Z]/.test(value)) return false;
  return /^[\p{L}\s'.-]+$/u.test(value);
}

export interface ParsedNameParts {
  prefix?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  preferred_name?: string;
  full_name: string;
}

const NAME_NOISE_TOKENS = new Set([
  "resume",
  "cv",
  "curriculum",
  "vitae",
  "candidate",
  "submittal",
  "cover",
  "page",
  "form",
  "status",
  "profile",
  "summary",
  "professional",
  "overview",
  "objective",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "contact",
  "phone",
  "email",
  "mobile",
  "linkedin",
  "github",
  "location",
  "engineer",
  "developer",
  "analyst",
  "architect",
  "consultant",
  "manager",
  "specialist",
  "administrator",
  "scientist",
  "intern",
  "coordinator",
  "operator",
  "devops",
  "sre",
  "lead",
  "senior",
  "junior",
  "principal",
  "staff",
  "associate",
  "data",
  "cloud",
  "software",
  "java",
  "python",
  "react",
  "reactjs",
  "frontend",
  "backend",
  "full",
  "stack",
  "etl",
  "aws",
  "gcp",
  "azure",
  "terraform",
  "portfolio",
  "piping",
  "hiring",
  "manager",
  "client",
  "feedback",
  "big",
  "inc",
  "llc",
  "corp",
  "ltd",
  "pvt",
  "limited",
  "management",
  "technologies",
  "solutions",
  "systems",
  "consulting",
  "unknown",
]);

const FILENAME_STRIP =
  /\b(20\d{2}|resume|cv|curriculum|vitae|updated|final|copy|draft|portfolio|submittal|docx?|pdf)\b/gi;

export function titleCasePersonName(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return trimmed;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length > 0 && letters === letters.toUpperCase();
  const allLower = letters.length > 0 && letters === letters.toLowerCase();
  if (!allCaps && !allLower) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z]\.?$/i.test(word)) return word.toUpperCase().replace(/\.$/, "") + (word.endsWith(".") ? "." : "");
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function looksLikePersonName(value: string): boolean {
  const trimmed = titleCasePersonName(value);
  if (!isValidName(trimmed)) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 5) return false;
  if (parts.some((part) => NAME_NOISE_TOKENS.has(part.toLowerCase().replace(/[.]/g, "")))) {
    return false;
  }
  return parts.every((part) => /^[\p{L}][\p{L}'.-]*\.?$/u.test(part) && part.replace(/[.]/g, "").length <= 24);
}

export function inferNameFromResumeFileName(fileName?: string): ParsedNameParts | null {
  if (!fileName) return null;
  let base = fileName.replace(/\.[^.]+$/, "");
  base = base.replace(/[_\-]+/g, " ");
  base = base.replace(/\(\d+\)/g, " ");
  base = base.replace(FILENAME_STRIP, " ");
  base = base.replace(
    /\b(?:sr\.?|senior|jr\.?|junior|lead|principal|staff)?\s*(?:dev\s*ops|devops|data|cloud|software|java|python|react(?:js)?|frontend|backend|full\s*stack|etl|sre|ai\/?ml)?\s*(?:engineer|developer|analyst|architect|consultant|manager|specialist)\b/gi,
    " ",
  );
  base = normalizeWhitespace(base)
    .split(/\s+/)
    .filter((token) => !NAME_NOISE_TOKENS.has(token.toLowerCase().replace(/[.]/g, "")))
    .join(" ");
  if (!looksLikePersonName(base)) return null;
  const tokens = base.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].replace(/[.]/g, "").length < 4) return null;
  return parseNameParts(titleCasePersonName(base));
}

export function parseNameParts(raw: string): ParsedNameParts | null {
  const trimmed = titleCasePersonName(raw.trim());
  if (!isValidName(trimmed)) return null;
  if (!looksLikePersonName(trimmed)) return null;

  let prefix: string | undefined;
  let suffix: string | undefined;
  let working = trimmed;

  const prefixMatch = working.match(NAME_PREFIXES);
  if (prefixMatch) {
    prefix = prefixMatch[0].trim().replace(/\.$/, "");
    working = working.replace(NAME_PREFIXES, "");
  }

  const suffixMatch = working.match(NAME_SUFFIXES);
  if (suffixMatch) {
    suffix = suffixMatch[1]?.replace(/\.$/, "");
    working = working.replace(NAME_SUFFIXES, "");
  }

  working = working.replace(DEGREE_TOKENS, "").replace(/,\s*$/, "").trim();
  working = normalizeWhitespace(working);
  if (!working) return null;

  const preferredMatch = working.match(/^(.+?)\s+\(([^)]+)\)$/);
  if (preferredMatch) {
    working = preferredMatch[1].trim();
  }

  const parts = working.split(/\s+/).filter(Boolean).map((part) =>
    part.length > 2 ? part.replace(/\.$/, "") : part,
  );
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    return {
      prefix,
      first_name: parts[0],
      full_name: stripNameTitles(trimmed),
      suffix,
      preferred_name: preferredMatch?.[2],
    };
  }

  if (parts.length === 2) {
    return {
      prefix,
      first_name: parts[0],
      last_name: parts[1],
      full_name: stripNameTitles(trimmed),
      suffix,
      preferred_name: preferredMatch?.[2],
    };
  }

  return {
    prefix,
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(" "),
    last_name: parts[parts.length - 1],
    full_name: stripNameTitles(trimmed),
    suffix,
    preferred_name: preferredMatch?.[2],
  };
}


export function classifyEmail(email: string) {
  const [, domain] = email.split("@");
  const provider = PUBLIC_EMAIL_PROVIDERS[domain];
  const is_disposable = DISPOSABLE_DOMAINS.has(domain);
  const is_educational =
    EDU_TLD_SUFFIXES.some((s) => domain.endsWith(s)) || domain.endsWith(".edu");
  const is_government = GOV_TLD_SUFFIXES.some((s) => domain.endsWith(s));
  const is_corporate = !provider && !is_disposable && !is_educational && !is_government;

  let domain_reputation: "public" | "corporate" | "education" | "government" = "public";
  if (is_government) domain_reputation = "government";
  else if (is_educational) domain_reputation = "education";
  else if (is_corporate) domain_reputation = "corporate";

  return {
    username: email.split("@")[0],
    domain,
    provider,
    is_business: is_corporate,
    is_disposable,
    is_educational,
    is_corporate,
    domain_reputation,
  };
}

const PHONE_PATTERNS = [
  /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:\s*(?:ext|x|#)\.?\s*\d{1,6})?/gi,
  /\(\d{3}\)\s*\d{3}[\s.-]?\d{4}(?:\s*(?:ext|x|#)\.?\s*\d{1,6})?/g,
  /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}(?:\s*(?:ext|x|#)\.?\s*\d{1,6})?/g,
  /\b\d{10,11}\b/g,
  /\+\d{10,14}\b/g,
];

export function extractAllPhones(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0].trim();
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) continue;
      if (seen.has(digits)) continue;
      seen.add(digits);
      results.push(raw);
    }
  }
  return results;
}

export function normalizePhone(raw: string): {
  normalized: string;
  country_code?: string;
  area_code?: string;
  national_number?: string;
  extension?: string;
  country?: string;
} | null {
  const extMatch = raw.match(/(?:ext|x|#)\.?\s*(\d{1,6})$/i);
  const extension = extMatch?.[1];
  const withoutExt = extMatch ? raw.slice(0, extMatch.index).trim() : raw;
  const digits = withoutExt.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;

  let country_code: string | undefined;
  let national: string;
  let country: string | undefined;

  if (withoutExt.startsWith("+") || digits.length > 10) {
    if (digits.startsWith("1") && digits.length === 11) {
      country_code = "1";
      national = digits.slice(1);
      country = "United States";
    } else if (digits.startsWith("91") && digits.length === 12) {
      country_code = "91";
      national = digits.slice(2);
      country = "India";
    } else if (digits.startsWith("44") && digits.length >= 11) {
      country_code = "44";
      national = digits.slice(2);
      country = "United Kingdom";
    } else {
      country_code = digits.slice(0, digits.length - 10);
      national = digits.slice(-10);
    }
  } else {
    country_code = "1";
    national = digits;
    country = "United States";
  }

  const area_code = national.length >= 10 ? national.slice(0, 3) : undefined;
  const national_number = national.length >= 10 ? national.slice(3) : national;
  const normalized = country_code
    ? `+${country_code}-${area_code ?? national.slice(0, 3)}-${national_number}`
    : national;

  return { normalized, country_code, area_code, national_number, extension, country };
}

export function normalizeLinkedInUrl(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (/linkedin\.com\/(?:jobs|company|feed|learning|school|pulse)/.test(lower)) return null;
  const match = raw.match(/linkedin\.com\/(?:in|pub)\/([\w-]+)/i);
  if (!match) return null;
  return `https://www.linkedin.com/in/${match[1].toLowerCase()}`;
}

export function normalizeGitHubUrl(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (/github\.com\/(?:search|topics|explore|trending|collections|marketplace)/.test(lower)) {
    return null;
  }
  const match = raw.match(/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/i);
  if (!match || ["settings", "notifications", "pulls", "issues"].includes(match[1].toLowerCase())) {
    return null;
  }
  return `https://github.com/${match[1]}`;
}

const PORTFOLIO_PLATFORMS: Array<{ regex: RegExp; platform: string; type: string }> = [
  { regex: /behance\.net\/[\w-]+/i, platform: "Behance", type: "Creative" },
  { regex: /dribbble\.com\/[\w-]+/i, platform: "Dribbble", type: "Creative" },
  { regex: /artstation\.com\/[\w-]+/i, platform: "ArtStation", type: "Creative" },
  { regex: /[\w-]+\.vercel\.app/i, platform: "Vercel", type: "Developer" },
  { regex: /[\w-]+\.netlify\.app/i, platform: "Netlify", type: "Developer" },
  { regex: /[\w-]+\.github\.io/i, platform: "GitHub Pages", type: "Developer" },
  { regex: /[\w-]+\.webflow\.io/i, platform: "Webflow", type: "Builder" },
  { regex: /[\w-]+\.wixsite\.com/i, platform: "Wix", type: "Builder" },
  { regex: /[\w-]+\.squarespace\.com/i, platform: "Squarespace", type: "Builder" },
  { regex: /[\w-]+\.carrd\.co/i, platform: "Carrd", type: "Builder" },
  { regex: /[\w-]+\.notion\.site/i, platform: "Notion", type: "Builder" },
  { regex: /medium\.com\/@[\w-]+/i, platform: "Medium", type: "Writing" },
  { regex: /dev\.to\/[\w-]+/i, platform: "Dev.to", type: "Writing" },
  { regex: /hashnode\.dev\/@[\w-]+/i, platform: "Hashnode", type: "Writing" },
  { regex: /[\w-]+\.substack\.com/i, platform: "Substack", type: "Writing" },
  { regex: /https?:\/\/[\w-]+\.(?:dev|io|me|app|design|works)(?:\/[\w./-]*)?/i, platform: "Personal", type: "Personal Domain" },
];

const PROFESSIONAL_PROFILE_PATTERNS: Array<{
  regex: RegExp;
  platform: string;
  type: string;
}> = [
  { regex: /leetcode\.com\/(?:u\/)?[\w-]+/i, platform: "LeetCode", type: "Coding" },
  { regex: /hackerrank\.com\/[\w-]+/i, platform: "HackerRank", type: "Coding" },
  { regex: /codechef\.com\/users\/[\w-]+/i, platform: "CodeChef", type: "Coding" },
  { regex: /codeforces\.com\/profile\/[\w-]+/i, platform: "Codeforces", type: "Coding" },
  { regex: /kaggle\.com\/[\w-]+/i, platform: "Kaggle", type: "Coding" },
  { regex: /stackoverflow\.com\/users\/\d+/i, platform: "Stack Overflow", type: "Coding" },
  { regex: /gitlab\.com\/[\w-]+/i, platform: "GitLab", type: "Coding" },
  { regex: /bitbucket\.org\/[\w-]+/i, platform: "Bitbucket", type: "Coding" },
  { regex: /figma\.com\/@[\w-]+/i, platform: "Figma", type: "Design" },
  { regex: /scholar\.google\.com\/citations\?user=[\w-]+/i, platform: "Google Scholar", type: "Research" },
  { regex: /researchgate\.net\/profile\/[\w-]+/i, platform: "ResearchGate", type: "Research" },
  { regex: /orcid\.org\/[\dX-]+/i, platform: "ORCID", type: "Research" },
  { regex: /producthunt\.com\/@[\w-]+/i, platform: "Product Hunt", type: "Product" },
  { regex: /wellfound\.com\/u\/[\w-]+|angel\.co\/u\/[\w-]+/i, platform: "AngelList", type: "Product" },
  { regex: /(?:twitter\.com|x\.com)\/[\w-]+/i, platform: "X", type: "Social" },
  { regex: /bsky\.app\/profile\/[\w.-]+/i, platform: "Bluesky", type: "Social" },
  { regex: /youtube\.com\/(?:@|c\/|channel\/)[\w-]+/i, platform: "YouTube", type: "Video" },
  { regex: /vimeo\.com\/[\w-]+/i, platform: "Vimeo", type: "Video" },
];

export function detectPortfolioUrl(text: string): {
  url: string;
  platform: string;
  type: string;
} | null {
  for (const { regex, platform, type } of PORTFOLIO_PLATFORMS) {
    const match = text.match(regex);
    if (match && !match[0].includes("linkedin") && !match[0].includes("github.com/")) {
      let url = match[0];
      if (!url.startsWith("http")) url = `https://${url}`;
      return { url, platform, type };
    }
  }
  return null;
}

export function detectProfessionalProfiles(text: string): Array<{
  url: string;
  platform: string;
  type: string;
  username?: string;
}> {
  const found: Array<{ url: string; platform: string; type: string; username?: string }> = [];
  const seen = new Set<string>();

  for (const { regex, platform, type } of PROFESSIONAL_PROFILE_PATTERNS) {
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (!match) continue;
    let url = match[0];
    if (!url.startsWith("http")) url = `https://${url}`;
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    const username = url.split("/").pop()?.replace(/^@/, "");
    found.push({ url, platform, type, username });
  }
  return found;
}

export function canonicalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http")) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.pathname = parsed.pathname.replace(/\/$/, "") || "/";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}
