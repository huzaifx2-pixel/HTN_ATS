import type { GoogleCseItem } from "@/lib/sourcing/google-cse";

const CERT_PATTERNS = [
  /aws certified[^\n,.]{0,40}/i,
  /azure[^\n,.]{0,30}certified/i,
  /google cloud[^\n,.]{0,30}/i,
  /pmp\b/i,
  /cissp\b/i,
  /oracle[^\n,.]{0,40}/i,
  /scrum master/i,
  /cka\b/i,
];

const DEGREE_RE =
  /\b((?:b\.?tech|b\.?e\.?|b\.?s\.?|bsc|ba|m\.?tech|m\.?s\.?|msc|mba|ph\.?d\.?|bachelor(?:'s)?|master(?:'s)?)[^,|]{0,60})/i;
const YEAR_RE = /\b((?:19|20)\d{2})\b/;
const EXP_RE = /\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/i;

export function canonicalizeLinkedInUrl(raw: string): { url: string; slug: string } | null {
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!parsed.hostname.replace(/^www\./, "").endsWith("linkedin.com")) return null;
    const match = parsed.pathname.match(/\/in\/([^/?#]+)/i);
    if (!match?.[1]) return null;
    const slug = decodeURIComponent(match[1]).replace(/\/+$/, "");
    if (!slug) return null;
    return {
      url: `https://www.linkedin.com/in/${slug}`,
      slug,
    };
  } catch {
    return null;
  }
}

function splitName(title: string) {
  const cleaned = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const firstSegment = cleaned.split(/\s[-–—|]\s/)[0]?.trim() || cleaned;
  const parts = firstSegment.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { fullName: "LinkedIn Profile", firstName: "LinkedIn", lastName: "Profile" };
  const firstName = parts[0]!;
  const lastName = parts.slice(1).join(" ") || firstName;
  return { fullName: `${firstName} ${parts.slice(1).join(" ")}`.trim(), firstName, lastName };
}

function parseHeadlineParts(title: string) {
  const cleaned = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const segments = cleaned.split(/\s[-–—]\s/).map((part) => part.trim()).filter(Boolean);
  const currentTitle = segments[1] || null;
  const currentCompany = segments[2] || null;
  return { currentTitle, currentCompany, headline: segments.slice(1).join(" · ") || null };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export type ParsedLinkedInSerp = {
  linkedInUrl: string;
  linkedInSlug: string;
  fullName: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  photoUrl: string | null;
  snippet: string;
  education: string | null;
  certifications: string[];
  skills: string[];
  experienceYears: number | null;
};

export function parseLinkedInSerpItem(item: GoogleCseItem, skillHints: string[] = []): ParsedLinkedInSerp | null {
  const canonical = canonicalizeLinkedInUrl(item.link);
  if (!canonical) return null;

  const names = splitName(item.title || canonical.slug);
  const headlineParts = parseHeadlineParts(item.title || "");
  const snippet = (item.snippet || item.pagemap?.metatags?.[0]?.["og:description"] || "").trim();
  const corpus = `${item.title}\n${snippet}`;

  const photoUrl = item.pagemap?.cse_image?.find((image) => image.src)?.src?.trim() || null;
  const expMatch = corpus.match(EXP_RE);
  const degreeMatch = corpus.match(DEGREE_RE);
  const yearMatch = corpus.match(YEAR_RE);
  const education = degreeMatch
    ? [degreeMatch[1]?.trim(), yearMatch?.[1]].filter(Boolean).join(", ")
    : null;

  const certifications = uniqueStrings(
    CERT_PATTERNS.map((pattern) => corpus.match(pattern)?.[0] ?? null)
  );

  const skills = uniqueStrings(
    skillHints.filter((hint) => new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(corpus))
  );

  const locationHint =
    corpus.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)(?:,\s*([A-Z][a-z]+))?\b/)?.[0] ??
    null;

  return {
    linkedInUrl: canonical.url,
    linkedInSlug: canonical.slug,
    fullName: names.fullName,
    firstName: names.firstName,
    lastName: names.lastName,
    headline: headlineParts.headline,
    currentTitle: headlineParts.currentTitle,
    currentCompany: headlineParts.currentCompany,
    location: locationHint,
    photoUrl,
    snippet,
    education,
    certifications,
    skills,
    experienceYears: expMatch ? Number(expMatch[1]) : null,
  };
}
