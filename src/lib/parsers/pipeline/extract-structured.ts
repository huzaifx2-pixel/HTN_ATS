import {
  extractSectionLines,
  extractResumeSkills,
  extractSkills,
  unionExperienceYears,
  countExperienceGaps,
  parseMonthYear,
  type SectionLine,
} from "@/lib/parsers/extraction";
import { extractContactInfo, flattenContactFields } from "@/lib/parsers/contact-extraction";
import { field } from "./parsed-field";
import { normalizeSkill, normalizeJobTitle, normalizeCompany, normalizeIsoDate } from "./normalize";
import { categorizeSkill } from "./skill-taxonomy";
import type {
  ParsedAward,
  ParsedCertification,
  ParsedEducationEntry,
  ParsedEmployment,
  ParsedProject,
  ParsedPublication,
  ParsedSkillEntry,
  ExperienceMetrics,
  ParseInsights,
  ResumeQualityScores,
} from "./types";
import type { ParsedContactInfo } from "@/lib/parsers/contact-types";

const DATE_RANGE =
  /(\w+\.?\s*\d{4}|\d{4})\s*(?:[-–—]|to)\s*(\w+\.?\s*\d{4}|\d{4}|present|current|now)/i;

const TITLE_HINT =
  /\b(engineer|developer|manager|analyst|director|consultant|specialist|architect|scientist|designer|recruiter|nurse|physician|therapist|coordinator|intern|officer|administrator|technician|associate|principal|staff|lead|vp|vice president|president|head|chief|fellow)\b/i;

const COMPANY_HINT =
  /\b(inc\.?|llc|ltd|corp\.?|co\.|company|university|hospital|group|labs?|technologies|systems|solutions|partners|clinic|health|medical|services)\b/i;

const CERT_PATTERNS = [
  /\b(AWS\s+Certified[^,\n]{0,60})/gi,
  /\b(PMP|CISSP|CCNA|CCNP|CKA|CKAD|Scrum Master|CSM|PSM[^,\n]{0,40})/gi,
  /\b(BLS|ACLS|PALS|NRP|TNCC|HIPAA)\b/gi,
  /\b(Certified[^,\n]{5,60})/gi,
];

const DEGREE_MAP: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\b(b\.?\s*s\.?|bachelor of science|bsc)\b/i, name: "Bachelor of Science" },
  { pattern: /\b(b\.?\s*a\.?|bachelor of arts)\b/i, name: "Bachelor of Arts" },
  { pattern: /\b(m\.?\s*s\.?|master of science|msc)\b/i, name: "Master of Science" },
  { pattern: /\b(m\.?\s*b\.?\s*a\.?|mba)\b/i, name: "Master of Business Administration" },
  { pattern: /\b(ph\.?\s*d\.?|doctorate|dphil)\b/i, name: "Doctor of Philosophy" },
  { pattern: /\b(b\.?\s*e\.?|bachelor of engineering|btech|b\.?\s*tech)\b/i, name: "Bachelor of Engineering" },
  { pattern: /\bbachelor/i, name: "Bachelor's Degree" },
  { pattern: /\bmaster/i, name: "Master's Degree" },
];

function lineEvidence(text: string, term: string, radius = 60): string | undefined {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return undefined;
  return text.slice(Math.max(0, idx - radius), idx + term.length + radius).trim();
}

function isBullet(line: string): boolean {
  return /^[-•*·]/.test(line) || line.length > 90;
}

function splitRoleCompany(text: string): { role?: string; company?: string } {
  const cleaned = text.replace(/\s{2,}/g, " ").trim();
  if (!cleaned) return {};

  const atMatch = cleaned.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) return { role: atMatch[1].trim(), company: atMatch[2].trim() };

  const parts = cleaned.split(/\s*[|@,]\s*|\s+[-–—]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [first, second] = parts;
    const firstTitle = TITLE_HINT.test(first);
    const secondTitle = TITLE_HINT.test(second);
    const firstCompany = COMPANY_HINT.test(first);
    const secondCompany = COMPANY_HINT.test(second);
    if (firstTitle && !secondTitle) return { role: first, company: second };
    if (secondTitle && !firstTitle) return { role: second, company: first };
    if (firstCompany && !secondCompany) return { role: second, company: first };
    if (secondCompany && !firstCompany) return { role: first, company: second };
    return { role: first, company: second };
  }

  if (TITLE_HINT.test(cleaned)) return { role: cleaned };
  if (COMPANY_HINT.test(cleaned)) return { company: cleaned };
  return {};
}

function monthsBetween(startIso?: string, endIso?: string, isCurrent?: boolean): number | undefined {
  if (!startIso) return undefined;
  const start = new Date(startIso);
  const end = isCurrent || !endIso ? new Date() : new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months > 0 && months < 600 ? months : undefined;
}

function parseSummary(lines: SectionLine[], fullText: string) {
  const body = lines.map((row) => row.text).join(" ").trim();
  if (body.length > 20) {
    return field(body.slice(0, 800), {
      confidence: 0.85,
      source: "resume",
      section: "summary",
      evidence: body.slice(0, 120),
      validated: true,
      page: lines[0]?.page,
      line: lines[0]?.line,
    });
  }
  const headerLines = fullText.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of headerLines.slice(0, 8)) {
    if (line.length > 80 && line.length < 500 && !line.includes("@") && !/\d{3}[-.\s]?\d{3}/.test(line)) {
      return field(line, { confidence: 0.6, source: "inferred", evidence: line.slice(0, 120) });
    }
  }
  return undefined;
}

function parseStructuredExperience(lines: SectionLine[], fullText: string): ParsedEmployment[] {
  const jobs: ParsedEmployment[] = [];
  let current: (Partial<ParsedEmployment> & {
    responsibilities: string[];
    achievements: string[];
    technologies: string[];
  }) | null = null;
  let pending: SectionLine[] = [];

  const flush = () => {
    if (!current?.company || !current?.jobTitle) {
      current = null;
      return;
    }
    current.durationMonths = monthsBetween(
      current.startDate?.value,
      current.endDate?.value,
      current.isCurrent,
    );
    jobs.push({
      company: current.company,
      jobTitle: current.jobTitle,
      location: current.location,
      startDate: current.startDate,
      endDate: current.endDate,
      isCurrent: current.isCurrent ?? false,
      durationMonths: current.durationMonths,
      responsibilities: current.responsibilities ?? [],
      achievements: current.achievements ?? [],
      technologies: current.technologies ?? [],
      description: current.description,
    });
    current = null;
  };

  const startJob = (row: SectionLine, dateMatch: RegExpMatchArray, extra: { role?: string; company?: string }) => {
    flush();
    const startNorm = normalizeIsoDate(dateMatch[1]);
    const endNorm = normalizeIsoDate(dateMatch[2]);
    const isCurrent = /present|current|now/i.test(dateMatch[2]);
    const role = extra.role || "Unknown Role";
    const company = extra.company || "Unknown Company";
    const lowConfidence = role === "Unknown Role" || company === "Unknown Company";
    current = {
      company: field(normalizeCompany(company), {
        confidence: lowConfidence ? 0.55 : 0.82,
        evidence: lineEvidence(fullText, company),
        validated: !lowConfidence,
        normalized: true,
        section: "experience",
        page: row.page,
        line: row.line,
        extractionMethod: "regex",
      }),
      jobTitle: field(normalizeJobTitle(role), {
        confidence: lowConfidence ? 0.55 : 0.85,
        evidence: lineEvidence(fullText, role),
        validated: !lowConfidence,
        normalized: true,
        section: "experience",
        page: row.page,
        line: row.line,
        extractionMethod: "regex",
      }),
      startDate: startNorm.iso
        ? field(startNorm.iso, { confidence: 0.78, evidence: dateMatch[1], page: row.page })
        : undefined,
      endDate: isCurrent
        ? undefined
        : endNorm.iso
          ? field(endNorm.iso, { confidence: 0.78, evidence: dateMatch[2], page: row.page })
          : undefined,
      isCurrent,
      responsibilities: [],
      achievements: [],
      technologies: [],
    };
    return current;
  };

  for (const row of lines) {
    const line = row.text;
    if (line.length < 3) continue;
    const dateMatch = line.match(DATE_RANGE);

    if (dateMatch) {
      const withoutDates = line.replace(dateMatch[0], "").replace(/[|–—,-]+$/g, "").trim();
      const split = splitRoleCompany(withoutDates);
      for (const prev of [...pending].reverse()) {
        if (!split.role && TITLE_HINT.test(prev.text)) split.role = prev.text;
        else if (!split.company) split.company = prev.text;
        else if (!split.role) split.role = prev.text;
      }
      pending = [];
      current = startJob(row, dateMatch, split);
      continue;
    }

    if (current && (isBullet(line) || line.length > 20)) {
      const cleaned = line.replace(/^[-•*·]\s*/, "");
      current.responsibilities!.push(cleaned);
      if (/\d+%|\$\d|increased|reduced|improved|delivered|achieved/i.test(line)) {
        current.achievements!.push(cleaned);
      }
      continue;
    }

    if (!isBullet(line) && line.length < 80) {
      pending.push(row);
      if (pending.length > 3) pending.shift();
    } else if (current) {
      current.responsibilities!.push(line.replace(/^[-•*·]\s*/, ""));
    }
  }
  flush();

  if (jobs.length === 0) {
    for (const row of lines.slice(0, 8)) {
      if (row.text.length < 4) continue;
      const parts = row.text.split(/[|–—-]/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        jobs.push({
          company: field(normalizeCompany(parts[1]), { confidence: 0.55, source: "inferred", page: row.page }),
          jobTitle: field(normalizeJobTitle(parts[0]), { confidence: 0.55, source: "inferred", page: row.page }),
          isCurrent: jobs.length === 0,
          responsibilities: [],
          achievements: [],
          technologies: [],
        });
      }
    }
  }

  for (const job of jobs) {
    job.technologies = extractSkills(job.responsibilities.join(" ")).slice(0, 12);
  }

  return jobs.slice(0, 16);
}

function parseStructuredEducation(lines: SectionLine[]): ParsedEducationEntry[] {
  const entries: ParsedEducationEntry[] = [];
  for (const row of lines.slice(0, 10)) {
    if (row.text.length < 4) continue;
    const yearMatch = row.text.match(/\b(19|20)\d{2}\b/);
    const honorsMatch = row.text.match(/\b(summa cum laude|magna cum laude|cum laude|with honors|dean'?s list)\b/i);
    const degreeHit = DEGREE_MAP.find((item) => item.pattern.test(row.text));
    const fieldMatch = row.text.match(
      /(?:in|of)\s+([A-Za-z][A-Za-z\s&]{2,40}?)(?:\s*[,|]|\s+\d{4}|$)/i,
    );
    const institution = row.text
      .split(/[,|]/)[0]
      ?.replace(degreeHit?.pattern ?? /^\s*$/, "")
      .replace(/\b(19|20)\d{2}\b/g, "")
      .trim() || row.text;

    entries.push({
      institution: field(institution, {
        confidence: 0.72,
        evidence: row.text.slice(0, 100),
        page: row.page,
        line: row.line,
        section: "education",
      }),
      degree: degreeHit
        ? field(degreeHit.name, { confidence: 0.85, normalized: true, page: row.page, section: "education" })
        : field(row.text, { confidence: 0.45, source: "inferred", page: row.page }),
      field: fieldMatch
        ? field(fieldMatch[1].trim(), { confidence: 0.65, page: row.page, section: "education" })
        : undefined,
      graduationDate: yearMatch?.[0],
      honors: honorsMatch?.[1],
    });
  }
  return entries;
}

function parseCertifications(text: string, lines: SectionLine[]): ParsedCertification[] {
  const found = new Set<string>();
  const certs: ParsedCertification[] = [];

  const pushCert = (name: string, evidence?: string, page?: number) => {
    const key = name.toLowerCase();
    if (!name || found.has(key) || name.length < 2) return;
    found.add(key);
    const issuerMatch = name.match(/\b(AWS|Google|Microsoft|CompTIA|Cisco|PMI|AHA|Red Cross)\b/i);
    const dateMatch = evidence?.match(/\b((?:19|20)\d{2})\b/);
    const idMatch = evidence?.match(/\b(?:id|credential)[:\s#]*([A-Z0-9-]{5,})\b/i);
    certs.push({
      name: field(name, { confidence: 0.8, evidence, page, section: "certifications" }),
      issuer: issuerMatch ? field(issuerMatch[1], { confidence: 0.7, page }) : undefined,
      issueDate: dateMatch?.[1],
      credentialId: idMatch?.[1],
      status: "unknown",
    });
  };

  for (const row of lines) {
    for (const part of row.text.split(/[,;|]/)) {
      const name = part.replace(/^[-•*]\s*/, "").trim();
      if (name.length >= 3 && name.length < 80) pushCert(name, row.text, row.page);
    }
  }

  for (const pattern of CERT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      pushCert(match[1]?.trim() || match[0].trim(), match[0]);
    }
  }
  return certs.slice(0, 20);
}

function parseNamedLines(
  lines: SectionLine[],
  section: string,
): Array<{ name: string; rest: string; page?: number; line: number }> {
  return lines.slice(0, 10).map((row) => ({
    name: row.text.split(/[-–—:]/)[0]?.trim() || row.text.slice(0, 80),
    rest: row.text,
    page: row.page,
    line: row.line,
  }));
}

function parseProjects(lines: SectionLine[]): ParsedProject[] {
  return parseNamedLines(lines, "projects").map((item) => ({
    name: field(item.name, { confidence: 0.65, section: "projects", page: item.page, line: item.line }),
    description: item.rest,
    technologies: extractSkills(item.rest).slice(0, 8),
  }));
}

function parseAwards(lines: SectionLine[]): ParsedAward[] {
  return parseNamedLines(lines, "awards").map((item) => ({
    name: field(item.name, { confidence: 0.65, section: "awards", page: item.page, line: item.line }),
    year: item.rest.match(/\b(19|20)\d{2}\b/)?.[0],
  }));
}

function parsePublications(lines: SectionLine[]): ParsedPublication[] {
  return parseNamedLines(lines, "publications").map((item) => ({
    title: field(item.name, { confidence: 0.65, section: "publications", page: item.page, line: item.line }),
    year: item.rest.match(/\b(19|20)\d{2}\b/)?.[0],
  }));
}

function buildSkillEntries(
  text: string,
  skillLines: string[],
  experience: ParsedEmployment[],
): ParsedSkillEntry[] {
  const experienceText = experience
    .flatMap((job) => [job.jobTitle.value, ...job.responsibilities, ...job.technologies])
    .join("\n");
  const rawSkills = extractResumeSkills(text, skillLines, experienceText);
  const seen = new Set<string>();
  const entries: ParsedSkillEntry[] = [];

  for (const raw of rawSkills) {
    const canonical = normalizeSkill(raw);
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const datedJobs = experience.filter((job) =>
      job.responsibilities.some((line) => line.toLowerCase().includes(key)) ||
      job.technologies.some((tech) => tech.toLowerCase() === key) ||
      job.jobTitle.value.toLowerCase().includes(key),
    );
    const yearsUsed = datedJobs.reduce((max, job) => Math.max(max, (job.durationMonths ?? 0) / 12), 0);
    const lastUsed = datedJobs.find((job) => job.isCurrent)?.endDate?.value
      ?? datedJobs[0]?.endDate?.value
      ?? (datedJobs[0]?.isCurrent ? new Date().toISOString().slice(0, 10) : undefined);

    entries.push({
      skill: field(canonical, {
        confidence: datedJobs.length > 0 ? 0.95 : skillLines.length > 0 ? 0.88 : 0.7,
        evidence: lineEvidence(text, raw),
        normalized: true,
        validated: true,
        section: "skills",
      }),
      category: categorizeSkill(canonical),
      explicit: skillLines.length > 0,
      yearsUsed: yearsUsed > 0 ? Math.round(yearsUsed * 10) / 10 : undefined,
      lastUsed,
    });
  }
  return entries.sort((a, b) => b.skill.confidence - a.skill.confidence);
}

function computeMetrics(experience: ParsedEmployment[]): ExperienceMetrics {
  const ranges = experience.flatMap((job) => {
    if (!job.startDate?.value) return [];
    const start = parseMonthYear(job.startDate.value) ?? new Date(job.startDate.value);
    const end = job.isCurrent
      ? new Date()
      : job.endDate?.value
        ? parseMonthYear(job.endDate.value) ?? new Date(job.endDate.value)
        : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    return [{ start, end }];
  });
  const totalYears = unionExperienceYears(ranges);
  const tenures = experience.map((job) => job.durationMonths).filter((value): value is number => Boolean(value));
  let leadership = 0;
  for (const job of experience) {
    if (/lead|manager|director|head|vp|chief/i.test(job.jobTitle.value)) {
      leadership += (job.durationMonths ?? 12) / 12;
    }
  }
  const avgTenure = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;
  const hopper =
    tenures.filter((t) => t > 0 && t < 12).length >= 3
      ? "high"
      : tenures.filter((t) => t > 0 && t < 18).length >= 2
        ? "medium"
        : "low";

  return {
    totalYears,
    relevantYears: totalYears,
    leadershipYears: Math.round(leadership * 10) / 10,
    managementYears: Math.round(leadership * 10) / 10,
    companyCount: experience.length,
    averageTenureMonths: Math.round(avgTenure),
    jobHopperRisk: hopper,
    gapCount: countExperienceGaps(ranges),
  };
}

function computeInsights(
  experience: ParsedEmployment[],
  skills: ParsedSkillEntry[],
  quality: ResumeQualityScores,
): ParseInsights {
  const current = experience.find((job) => job.isCurrent) ?? experience[0];
  const title = current?.jobTitle.value ?? "";
  let seniority = "Mid-Level";
  if (/junior|jr\.|entry|intern|associate/i.test(title)) seniority = "Junior";
  if (/senior|sr\.|lead|principal|staff/i.test(title)) seniority = "Senior";
  if (/director|vp|head|chief|manager/i.test(title)) seniority = "Leadership";

  let promotionTrend: ParseInsights["promotionTrend"] = "unknown";
  if (experience.length >= 3) {
    const titles = experience.map((job) => job.jobTitle.value.toLowerCase());
    const ranks = titles.map((value) => {
      if (/chief|vp|head|director/.test(value)) return 4;
      if (/senior|principal|staff|lead/.test(value)) return 3;
      if (/manager/.test(value)) return 3;
      if (/junior|intern/.test(value)) return 1;
      return 2;
    });
    const first = ranks[ranks.length - 1];
    const last = ranks[0];
    promotionTrend = last > first ? "upward" : last < first ? "lateral" : "mixed";
  }

  return {
    currentSeniority: seniority,
    careerLevel: seniority,
    primaryProfession: title || undefined,
    topSkills: skills.slice(0, 8).map((s) => s.skill.value),
    skillDensity: Math.min(100, skills.length * 4),
    resumeCompleteness: quality.overall,
    promotionTrend,
  };
}

export function scoreResumeQuality(
  text: string,
  contact: ParsedContactInfo,
  experience: ParsedEmployment[],
  skills: ParsedSkillEntry[],
  education: ParsedEducationEntry[],
  presentSections: string[],
): ResumeQualityScores {
  const expected = ["experience", "education", "skills"];
  const missing = expected.filter((section) => !presentSections.includes(section));
  const contactScore = contact.quality.contact_completeness_score ?? 0;
  const sectionScore = ((expected.length - missing.length) / expected.length) * 100;
  const keywordDensity = Math.min(100, skills.length * 5);
  const readability = text.length > 200 && text.length < 15000 ? 85 : 60;
  const overall = Math.round(
    contactScore * 0.3 +
      sectionScore * 0.25 +
      keywordDensity * 0.2 +
      readability * 0.15 +
      (experience.length > 0 ? 10 : 0) +
      (education.length > 0 ? 5 : 0),
  );

  return {
    formatting: 75,
    readability,
    contactCompleteness: contactScore,
    sectionCompleteness: sectionScore,
    keywordDensity,
    overall: Math.min(100, overall),
    missingSections: missing,
  };
}

export function extractStructuredFromText(input: {
  rawText: string;
  resumeType: string;
  ocrUsed: boolean;
  ocrConfidence?: number;
  fileName?: string;
}) {
  const sections = extractSectionLines(input.rawText);
  const contact = extractContactInfo(input.rawText, {
    resumeType: input.resumeType as "PDF" | "DOCX" | "TEXT" | "UNKNOWN",
    scannedPdf: input.ocrUsed,
    fileName: input.fileName,
  });
  const flat = flattenContactFields(contact);
  const experience = parseStructuredExperience(sections.experience, input.rawText);
  const education = parseStructuredEducation(sections.education);
  const skills = buildSkillEntries(
    input.rawText,
    sections.skills.map((row) => row.text),
    experience,
  );
  const certifications = parseCertifications(input.rawText, sections.certifications);
  const projects = parseProjects(sections.projects);
  const awards = parseAwards(sections.awards);
  const publications = parsePublications(sections.publications);
  const summary = parseSummary(sections.summary, input.rawText);
  const presentSections = Object.entries(sections)
    .filter(([key, rows]) => key !== "other" && rows.length > 0)
    .map(([key]) => key);
  const quality = scoreResumeQuality(input.rawText, contact, experience, skills, education, presentSections);
  const metrics = computeMetrics(experience);
  const insights = computeInsights(experience, skills, quality);

  const languages = [
    ...sections.languages.flatMap((row) =>
      row.text.split(/[,;|]/).map((part) => part.replace(/^languages?\s*:?\s*/i, "").trim()).filter(Boolean),
    ),
  ].map((lang) => field(lang, { confidence: 0.7, section: "languages" }));

  if (languages.length === 0) {
    const langMatch = input.rawText.match(/languages?\s*:?\s*([^\n]+)/i);
    if (langMatch) {
      for (const lang of langMatch[1].split(/[,;|]/)) {
        const value = lang.trim();
        if (value) languages.push(field(value, { confidence: 0.7, section: "languages" }));
      }
    }
  }

  return {
    contact,
    flat,
    summary,
    skills,
    experience,
    education,
    certifications,
    projects,
    awards,
    publications,
    languages,
    metrics,
    insights,
    quality,
    totalYears: metrics.totalYears,
  };
}
