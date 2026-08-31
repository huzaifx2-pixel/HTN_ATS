import type { Prisma } from "@prisma/client";
import type { CandidateSearchMode } from "@/lib/services/search-utils";
import { buildCandidateSearchWhereForMode } from "@/lib/services/search-utils";

export type CandidateSearchFilters = {
  query?: string;
  mode?: CandidateSearchMode;
  /** Job being sourced for; persisted on saved searches, not used as a candidate filter. */
  jobId?: string;
  skills?: string[];
  location?: string;
  city?: string;
  country?: string;
  company?: string;
  minExperience?: number;
  maxExperience?: number;
  workAuthorization?: string;
  availability?: string;
  willingToRelocate?: boolean;
  minSalary?: number;
  maxSalary?: number;
  education?: string;
  title?: string;
  certification?: string;
};

export function parseCandidateSearchFilters(params: Record<string, string | undefined>): CandidateSearchFilters {
  const skills = params.skills?.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    query: params.q?.trim() || undefined,
    mode: (params.mode as CandidateSearchMode) || "all",
    jobId: params.jobId?.trim() || undefined,
    skills: skills?.length ? skills : undefined,
    location: params.location?.trim() || undefined,
    city: params.city?.trim() || undefined,
    country: params.country?.trim() || undefined,
    company: params.company?.trim() || undefined,
    minExperience: params.minExp ? Number(params.minExp) : undefined,
    maxExperience: params.maxExp ? Number(params.maxExp) : undefined,
    workAuthorization: params.visa?.trim() || undefined,
    availability: params.availability?.trim() || undefined,
    willingToRelocate: params.relocate === "1" ? true : params.relocate === "0" ? false : undefined,
    minSalary: params.minSalary ? Number(params.minSalary) : undefined,
    maxSalary: params.maxSalary ? Number(params.maxSalary) : undefined,
    education: params.education?.trim() || undefined,
    title: params.title?.trim() || undefined,
    certification: params.certification?.trim() || undefined,
  };
}

export function buildAdvancedCandidateWhere(
  organizationId: string,
  filters: CandidateSearchFilters,
): Prisma.CandidateWhereInput {
  const and: Prisma.CandidateWhereInput[] = [{ organizationId, deletedAt: null }];

  if (filters.query?.trim()) {
    and.push(buildCandidateSearchWhereForMode(filters.query, filters.mode ?? "all"));
  }
  if (filters.skills?.length) {
    and.push({
      AND: filters.skills.map((skill) => ({
        OR: [
          { headline: { contains: skill, mode: "insensitive" } },
          { summary: { contains: skill, mode: "insensitive" } },
          { candidateSkills: { some: { skill: { name: { contains: skill, mode: "insensitive" } } } } },
          { searchIndex: { searchDocument: { contains: skill, mode: "insensitive" } } },
        ],
      })),
    });
  }
  if (filters.location) and.push({ location: { contains: filters.location, mode: "insensitive" } });
  if (filters.city) and.push({ city: { contains: filters.city, mode: "insensitive" } });
  if (filters.country) and.push({ country: { contains: filters.country, mode: "insensitive" } });
  if (filters.company) {
    and.push({
      OR: [
        { currentCompany: { contains: filters.company, mode: "insensitive" } },
        { currentEmployer: { name: { contains: filters.company, mode: "insensitive" } } },
        { experiences: { some: { company: { contains: filters.company, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters.title) {
    and.push({
      OR: [
        { currentTitle: { contains: filters.title, mode: "insensitive" } },
        { currentRole: { contains: filters.title, mode: "insensitive" } },
        { headline: { contains: filters.title, mode: "insensitive" } },
        { experiences: { some: { title: { contains: filters.title, mode: "insensitive" } } } },
      ],
    });
  }
  if (filters.workAuthorization) {
    and.push({ workAuthorization: { contains: filters.workAuthorization, mode: "insensitive" } });
  }
  if (filters.availability) {
    and.push({ availability: { contains: filters.availability, mode: "insensitive" } });
  }
  if (filters.education) {
    and.push({
      OR: [
        {
          parsedResume: {
            OR: [
              { education: { string_contains: filters.education } },
              { summary: { contains: filters.education, mode: "insensitive" } },
            ],
          },
        },
        {
          educations: {
            some: {
              OR: [
                { institution: { contains: filters.education, mode: "insensitive" } },
                { degree: { contains: filters.education, mode: "insensitive" } },
                { field: { contains: filters.education, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }
  if (filters.certification) {
    and.push({
      OR: [
        { candidateCerts: { some: { name: { contains: filters.certification, mode: "insensitive" } } } },
        { searchIndex: { searchDocument: { contains: filters.certification, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.minExperience !== undefined || filters.maxExperience !== undefined) {
    and.push({
      experienceYears: {
        ...(filters.minExperience !== undefined ? { gte: filters.minExperience } : {}),
        ...(filters.maxExperience !== undefined ? { lte: filters.maxExperience } : {}),
      },
    });
  }
  if (filters.minSalary !== undefined || filters.maxSalary !== undefined) {
    and.push({
      desiredSalary: {
        ...(filters.minSalary !== undefined ? { gte: filters.minSalary } : {}),
        ...(filters.maxSalary !== undefined ? { lte: filters.maxSalary } : {}),
      },
    });
  }
  if (filters.willingToRelocate !== undefined) {
    and.push({
      metadata: {
        path: ["willingToRelocate"],
        equals: filters.willingToRelocate,
      },
    });
  }

  return { AND: and };
}

export function filtersToSearchParams(filters: CandidateSearchFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.query) params.q = filters.query;
  if (filters.mode) params.mode = filters.mode;
  if (filters.jobId) params.jobId = filters.jobId;
  if (filters.skills?.length) params.skills = filters.skills.join(",");
  if (filters.location) params.location = filters.location;
  if (filters.city) params.city = filters.city;
  if (filters.country) params.country = filters.country;
  if (filters.company) params.company = filters.company;
  if (filters.minExperience !== undefined) params.minExp = String(filters.minExperience);
  if (filters.maxExperience !== undefined) params.maxExp = String(filters.maxExperience);
  if (filters.workAuthorization) params.visa = filters.workAuthorization;
  if (filters.availability) params.availability = filters.availability;
  if (filters.willingToRelocate !== undefined) params.relocate = filters.willingToRelocate ? "1" : "0";
  if (filters.minSalary !== undefined) params.minSalary = String(filters.minSalary);
  if (filters.maxSalary !== undefined) params.maxSalary = String(filters.maxSalary);
  if (filters.education) params.education = filters.education;
  if (filters.title) params.title = filters.title;
  if (filters.certification) params.certification = filters.certification;
  return params;
}
