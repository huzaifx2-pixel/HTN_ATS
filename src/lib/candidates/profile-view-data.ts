import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";

export type ProfileCandidate = {
  headline?: string | null;
  summary?: string | null;
  currentCompany?: string | null;
  currentRole?: string | null;
  experienceYears?: number | null;
  workAuthorization?: string | null;
  availability?: string | null;
  location?: string | null;
  metadata?: unknown;
  parsedResume?: {
    structured?: unknown;
    parseMetadata?: unknown;
    summary?: string | null;
    experience?: unknown;
    education?: unknown;
    certifications?: unknown;
    projects?: unknown;
  } | null;
  candidateSkills?: Array<{
    skill: { name: string };
    metadata?: unknown;
  }>;
  currentEmployer?: { name: string } | null;
  experiences?: Array<{
    company: string;
    title: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    isCurrent: boolean;
    responsibilities?: unknown;
  }>;
  educations?: Array<{
    institution: string;
    degree?: string | null;
    field?: string | null;
    graduationDate?: string | null;
  }>;
  candidateCerts?: Array<{
    name: string;
    issuer?: string | null;
    expiryDate?: string | null;
    credentialId?: string | null;
  }>;
};

export type ProfileExperience = {
  company: string;
  title: string;
  start?: string;
  end?: string;
  isCurrent?: boolean;
  responsibilities?: string[];
};

export type ProfileEducation = {
  institution: string;
  degree?: string;
  field?: string;
  year?: string;
};

export type ProfileCertification = {
  name: string;
  issuer?: string;
  expiry?: string;
  credentialId?: string;
};

function fieldValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "value" in (value as object)) {
    return String((value as { value?: unknown }).value ?? "");
  }
  return String(value);
}

export function getStructured(candidate: ProfileCandidate): StructuredParseResult | null {
  const structured = candidate.parsedResume?.structured;
  if (structured && typeof structured === "object") return structured as StructuredParseResult;
  return null;
}

export function getSkillsByCategory(candidate: ProfileCandidate): Map<string, string[]> {
  const structured = getStructured(candidate);
  const skillsByCategory = new Map<string, string[]>();
  if (structured?.skills?.length) {
    for (const skill of structured.skills) {
      const category = skill.category || "Technical";
      const list = skillsByCategory.get(category) ?? [];
      list.push(skill.skill.value);
      skillsByCategory.set(category, list);
    }
    return skillsByCategory;
  }
  for (const row of candidate.candidateSkills ?? []) {
    const category = ((row.metadata as { category?: string } | null)?.category) ?? "Technical";
    const list = skillsByCategory.get(category) ?? [];
    list.push(row.skill.name);
    skillsByCategory.set(category, list);
  }
  return skillsByCategory;
}

export function getSkillNames(candidate: ProfileCandidate): string[] {
  return [...getSkillsByCategory(candidate).values()].flat();
}

export function getExperienceRows(candidate: ProfileCandidate): ProfileExperience[] {
  const structured = getStructured(candidate);
  if (structured?.experience?.length) {
    return structured.experience.map((job) => ({
      company: job.company.value,
      title: job.jobTitle.value,
      start: job.startDate?.value,
      end: job.isCurrent ? "Present" : job.endDate?.value,
      isCurrent: job.isCurrent,
      responsibilities: job.responsibilities,
    }));
  }
  if (Array.isArray(candidate.parsedResume?.experience)) {
    return (candidate.parsedResume!.experience as Array<{
      company: string;
      role: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      responsibilities?: string[];
    }>).map((job) => ({
      company: job.company,
      title: job.role,
      start: job.startDate,
      end: job.isCurrent ? "Present" : job.endDate,
      isCurrent: job.isCurrent,
      responsibilities: job.responsibilities,
    }));
  }
  return (candidate.experiences ?? []).map((job) => ({
    company: job.company,
    title: job.title,
    start: job.startDate ? String(job.startDate).slice(0, 10) : undefined,
    end: job.isCurrent ? "Present" : job.endDate ? String(job.endDate).slice(0, 10) : undefined,
    isCurrent: job.isCurrent,
    responsibilities: Array.isArray(job.responsibilities) ? (job.responsibilities as string[]) : undefined,
  }));
}

export function getEducationRows(candidate: ProfileCandidate): ProfileEducation[] {
  const structured = getStructured(candidate);
  if (structured?.education?.length) {
    return structured.education.map((row) => ({
      institution: row.institution.value,
      degree: row.degree?.value,
      field: row.field?.value,
      year: row.graduationDate ?? row.endDate,
    }));
  }
  if (Array.isArray(candidate.parsedResume?.education)) {
    return (candidate.parsedResume!.education as Array<Record<string, unknown>>).map((row) => ({
      institution: fieldValue(row.institution),
      degree: fieldValue(row.degree) || undefined,
      field: fieldValue(row.field) || undefined,
      year: fieldValue(row.graduationDate || row.year) || undefined,
    }));
  }
  return (candidate.educations ?? []).map((row) => ({
    institution: row.institution,
    degree: row.degree ?? undefined,
    field: row.field ?? undefined,
    year: row.graduationDate ?? undefined,
  }));
}

export function getCertificationRows(candidate: ProfileCandidate): ProfileCertification[] {
  const structured = getStructured(candidate);
  if (structured?.certifications?.length) {
    return structured.certifications.map((row) => ({
      name: row.name.value,
      issuer: row.issuer?.value,
      expiry: row.expiryDate,
      credentialId: row.credentialId,
    }));
  }
  if (Array.isArray(candidate.parsedResume?.certifications)) {
    return (candidate.parsedResume!.certifications as Array<Record<string, unknown> | string>).map((row) =>
      typeof row === "string"
        ? { name: row }
        : {
            name: fieldValue(row.name) || "Certification",
            issuer: fieldValue(row.issuer) || undefined,
            expiry: fieldValue(row.expiryDate || row.expiry) || undefined,
            credentialId: fieldValue(row.credentialId) || undefined,
          },
    );
  }
  return (candidate.candidateCerts ?? []).map((row) => ({
    name: row.name,
    issuer: row.issuer ?? undefined,
    expiry: row.expiryDate ?? undefined,
    credentialId: row.credentialId ?? undefined,
  }));
}

export function highlightSkillTerms(text: string, skills: string[]): Array<string | { mark: string }> {
  if (!text || skills.length === 0) return [text];
  const unique = [...new Set(skills.filter((skill) => skill.trim().length > 2))].sort(
    (a, b) => b.length - a.length,
  );
  if (unique.length === 0) return [text];
  const pattern = new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "gi");
  const parts: Array<string | { mark: string }> = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push({ mark: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
