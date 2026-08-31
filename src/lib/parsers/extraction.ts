/**
 * Resume field extraction adapted from pyresparser (MIT)
 * https://github.com/OmkarPathak/pyresparser
 */
import fs from "node:fs";
import Papa from "papaparse";
import { getSkillsCsvPath } from "@/lib/runtime/paths";
import type { ParsedEducation, ParsedExperience } from "./types";
import {
  extractEmail as contactExtractEmail,
  extractPhone as contactExtractPhone,
  extractName as contactExtractName,
} from "./contact-extraction";

export type ResumeSectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "publications"
  | "awards"
  | "languages"
  | "other";

export interface SectionLine {
  text: string;
  page?: number;
  line: number;
}

const HEADING_ALIASES: Array<{ key: ResumeSectionKey; pattern: RegExp }> = [
  {
    key: "experience",
    pattern:
      /^(work\s+)?experience$|^(professional|relevant)\s+experience$|^employment(\s+history)?$|^work\s+history$|^career\s+history$|^professional\s+background$/i,
  },
  { key: "education", pattern: /^education$|^academic(\s+background)?$|^academics$|^qualifications$/i },
  {
    key: "skills",
    pattern:
      /^(technical\s+)?skills$|^core\s+competenc(y|ies)$|^technologies$|^tech\s+stack$|^expertise$|^proficiencies$/i,
  },
  {
    key: "certifications",
    pattern:
      /^certifications?$|^licenses?\s*(&|and)?\s*certifications?$|^licenses?$|^credentials$/i,
  },
  { key: "projects", pattern: /^projects?$|^selected\s+projects$|^personal\s+projects$/i },
  { key: "publications", pattern: /^publications?$|^papers$|^research(\s+papers)?$/i },
  { key: "awards", pattern: /^awards?$|^honors?$|^honors?\s*(&|and)?\s*awards?$|^achievements$/i },
  { key: "languages", pattern: /^languages?$/i },
  {
    key: "summary",
    pattern:
      /^summary$|^professional\s+summary$|^profile$|^about$|^objective$|^career\s+objective$|^career\s+profile$/i,
  },
];

const EDUCATION_KEYWORDS = new Set([
  "be", "b.e.", "b.e", "bs", "b.s", "me", "m.e", "m.e.", "ms", "m.s",
  "btech", "mtech", "ssc", "hsc", "cbse", "icse", "mba", "phd", "bachelor", "master",
]);

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "them",
]);

const SKILL_NOISE = new Set([
  "click", "flower", "beets", "cement", "cliff", "clint", "colorama", "fire", "gooey",
  "hermes", "johnny", "mingus", "sanction", "rauth", "timeside", "tinytag", "wooey",
  "widgy", "kotti", "opps", "quokka", "beaker", "errbot", "coala", "ajenti", "grappelli",
  "fanstatic", "eyed3", "talkbox", "authomatic", "jose", "bitbake", "buildout", "scons",
  "djedi", "feincms", "plone", "dogpile", "asciimatics",
]);

const ALLOWED_SHORT_SKILLS = new Set(["c", "r", "go", "ai", "ml", "js", "ts", "c#", "c++", "sql", "aws", "gcp", "ci", "cd", "ui", "ux", "qa", "rn", "np"]);

let skillsCache: Set<string> | null = null;

function isValidNameLine(line: string): boolean {
  if (!line || line.length > 60) return false;
  if (line.includes("@")) return false;
  return !/resume|curriculum vitae|phone|email/i.test(line);
}

function loadSkills(): Set<string> {
  if (skillsCache) return skillsCache;

  const csvPath = getSkillsCsvPath();
  const content = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse(content, { header: true, preview: 1 });
  const fields = parsed.meta.fields ?? [];

  skillsCache = new Set(
    fields
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 1 && !SKILL_NOISE.has(s))
  );
  return skillsCache;
}

function matchHeading(line: string): ResumeSectionKey | null {
  const cleaned = line.replace(/[:\-|•]+$/g, "").trim();
  if (!cleaned || cleaned.length > 48) return null;
  if (cleaned.includes("@") || /\d{3}[\s.-]?\d{3}/.test(cleaned)) return null;
  if (/^-- page \d+/i.test(cleaned)) return null;
  for (const { key, pattern } of HEADING_ALIASES) {
    if (pattern.test(cleaned)) return key;
  }
  return null;
}

export function extractSectionLines(text: string): Record<ResumeSectionKey, SectionLine[]> {
  const lines = text.split("\n");
  const entities: Record<ResumeSectionKey, SectionLine[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    publications: [],
    awards: [],
    languages: [],
    other: [],
  };
  let currentKey: ResumeSectionKey | null = null;
  let page = 1;
  let lineNo = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    const pageMark = trimmed.match(/^-- page (\d+)/i);
    if (pageMark) {
      page = Number(pageMark[1]);
      continue;
    }
    if (!trimmed) continue;
    lineNo += 1;
    const heading = matchHeading(trimmed);
    if (heading) {
      currentKey = heading;
      continue;
    }
    const key = currentKey ?? "other";
    entities[key].push({ text: trimmed, page, line: lineNo });
  }

  return entities;
}

export function extractEmail(text: string): string | undefined {
  return contactExtractEmail(text);
}

export function extractPhone(text: string): string | undefined {
  return contactExtractPhone(text);
}

export function extractName(text: string): { firstName?: string; lastName?: string; fullName?: string } {
  return contactExtractName(text);
}

/** Section-based parsing with whole-line heading match. */
export function extractSections(text: string): Record<string, string[]> {
  const lined = extractSectionLines(text);
  const out: Record<string, string[]> = {};
  for (const [key, rows] of Object.entries(lined)) {
    if (rows.length > 0) out[key] = rows.map((row) => row.text);
  }
  return out;
}

function isNoisySkill(token: string): boolean {
  const key = token.toLowerCase().trim();
  if (!key) return true;
  if (SKILL_NOISE.has(key)) return true;
  if (STOP_WORDS.has(key)) return true;
  if (key.length <= 2 && !ALLOWED_SHORT_SKILLS.has(key)) return true;
  return false;
}

function vocabMatch(text: string): string[] {
  const skills = loadSkills();
  const normalized = text.toLowerCase();
  const tokens = normalized
    .replace(/[^\w\s+#.+-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t) && !isNoisySkill(t));

  const found = new Set<string>();

  for (const token of tokens) {
    if (skills.has(token)) found.add(token);
  }

  const words = normalized.replace(/[^\w\s+#.+-/]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    for (const n of [2, 3]) {
      const phrase = words.slice(i, i + n).join(" ");
      if (skills.has(phrase) && !isNoisySkill(phrase)) found.add(phrase);
    }
  }

  return [...found].map((s) =>
    s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
  );
}

export function splitSkillList(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    for (const part of line.split(/[,;|•·/]/)) {
      const token = part.replace(/^[-*]\s*/, "").trim();
      if (token.length < 2 || token.length > 48) continue;
      if (token.split(/\s+/).length > 4) continue;
      if (isNoisySkill(token)) continue;
      items.push(token);
    }
  }
  return items;
}

/** Skill matching using pyresparser's skills.csv vocabulary, with noise filter. */
export function extractSkills(text: string): string[] {
  return vocabMatch(text);
}

export function extractResumeSkills(_text: string, skillSectionLines: string[], experienceText: string): string[] {
  const listed = splitSkillList(skillSectionLines);
  const fromScoped = vocabMatch([...skillSectionLines, experienceText].join("\n"));
  const combined = [...listed, ...fromScoped];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of combined) {
    const key = item.toLowerCase();
    if (seen.has(key) || isNoisySkill(item)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

export function parseMonthYear(value: string): Date | null {
  const cleaned = value.trim().replace(/\./g, "");
  if (/present|current|now/i.test(cleaned)) return new Date();

  const mmyyyy = cleaned.match(/([a-z]+)\s*(\d{4})/i);
  if (mmyyyy) {
    const month = MONTHS[mmyyyy[1].slice(0, 3).toLowerCase()] ?? MONTHS[mmyyyy[1].toLowerCase()];
    if (month !== undefined) return new Date(Number(mmyyyy[2]), month, 1);
  }

  const yyyy = cleaned.match(/\b(19|20)\d{2}\b/);
  if (yyyy) return new Date(Number(yyyy[0]), 0, 1);

  return null;
}

export type DateRange = { start: Date; end: Date };

export function unionExperienceYears(ranges: DateRange[]): number {
  const valid = ranges
    .filter((range) => range.end.getTime() > range.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (valid.length === 0) return 0;

  const merged: DateRange[] = [{ ...valid[0] }];
  for (const range of valid.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start.getTime() <= last.end.getTime()) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }

  let months = 0;
  for (const range of merged) {
    const value =
      (range.end.getFullYear() - range.start.getFullYear()) * 12 +
      (range.end.getMonth() - range.start.getMonth());
    if (value > 0 && value < 600) months += value;
  }
  return months > 0 ? Math.round((months / 12) * 10) / 10 : 0;
}

export function countExperienceGaps(ranges: DateRange[], minGapMonths = 3): number {
  const valid = ranges
    .filter((range) => range.end.getTime() > range.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  let gaps = 0;
  for (let i = 1; i < valid.length; i++) {
    const prevEnd = valid[i - 1].end;
    const nextStart = valid[i].start;
    const gap =
      (nextStart.getFullYear() - prevEnd.getFullYear()) * 12 +
      (nextStart.getMonth() - prevEnd.getMonth());
    if (gap > minGapMonths) gaps += 1;
  }
  return gaps;
}

/** Total experience in years — union of dated ranges (no double-count of overlaps). */
export function extractTotalExperienceYears(text: string): number {
  const dateRangeRegex =
    /(\w+\.?\s*\d{4}|\d{4})\s*(?:[-–—]|to)\s*(\w+\.?\s*\d{4}|\d{4}|present|current|now)/gi;
  const ranges: DateRange[] = [];
  let match: RegExpExecArray | null;

  while ((match = dateRangeRegex.exec(text)) !== null) {
    const start = parseMonthYear(match[1]);
    const end = parseMonthYear(match[2]);
    if (start && end) ranges.push({ start, end });
  }

  return unionExperienceYears(ranges);
}

export function parseExperience(text: string): ParsedExperience[] {
  const sections = extractSections(text);
  const expLines = sections.experience ?? [];

  const experiences: ParsedExperience[] = [];

  for (const line of expLines.slice(0, 8)) {
    if (line.length < 4) continue;
    const dateMatch = line.match(/(\w+\.?\s*\d{4}|\d{4})\s*(?:[-–—]|to)\s*(\w+\.?\s*\d{4}|\d{4}|present|current)/i);
    const withoutDates = dateMatch ? line.replace(dateMatch[0], "").trim() : line;
    const parts = withoutDates.split(/[|–—-]/).map((p) => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      experiences.push({
        role: parts[0],
        company: parts[1],
        startDate: dateMatch?.[1],
        endDate: dateMatch?.[2],
        description: parts.slice(2).join(" "),
      });
    } else if (parts.length === 1 && isValidNameLine(parts[0])) {
      experiences.push({ role: parts[0], company: "Unknown" });
    }
  }

  return experiences;
}

export function parseEducation(text: string): ParsedEducation[] {
  const sections = extractSections(text);
  const eduLines = sections.education ?? [];
  const education: ParsedEducation[] = [];

  for (const line of eduLines.slice(0, 6)) {
    if (line.length < 4) continue;
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    const degreeToken = line.split(/\s+/).find((w) =>
      EDUCATION_KEYWORDS.has(w.replace(/[?|$|.|!|,]/g, "").toLowerCase())
    );

    education.push({
      institution: line,
      degree: degreeToken,
      year: yearMatch?.[0],
    });
  }

  return education;
}
