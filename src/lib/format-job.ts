import {
  getSalaryPeriodFromMetadata,
  SALARY_PERIODS,
  type SalaryPeriod,
} from "@/lib/constants/salary-periods";

type JobLocationFields = {
  location?: string | null;
  country?: string | null;
};

type JobSalaryFields = {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  metadata?: unknown;
  salaryPeriod?: SalaryPeriod;
};

export function formatJobLocation(job: JobLocationFields): string {
  const location = job.location?.trim();
  const country = job.country?.trim();

  if (country === "Global") {
    return location || "Global";
  }
  if (location && country) {
    if (location.toLowerCase() === country.toLowerCase()) return location;
    return `${location}, ${country}`;
  }
  return location || country || "—";
}

export function formatJobSalary(job: JobSalaryFields): string {
  const salaryMin = job.salaryMin != null ? Number(job.salaryMin) : undefined;
  const salaryMax = job.salaryMax != null ? Number(job.salaryMax) : undefined;
  const currency = job.salaryCurrency?.trim() || "USD";
  const period =
    SALARY_PERIODS.find(
      (entry) => entry.value === (job.salaryPeriod ?? getSalaryPeriodFromMetadata(job.metadata))
    )?.label ?? "/annum";

  if (salaryMin == null && salaryMax == null) {
    return "Competitive";
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (salaryMin != null && salaryMax != null) {
    if (salaryMin === salaryMax) {
      return `${formatter.format(salaryMin)}${period}`;
    }
    return `${formatter.format(salaryMin)} – ${formatter.format(salaryMax)}${period}`;
  }
  if (salaryMin != null) {
    return `From ${formatter.format(salaryMin)}${period}`;
  }
  return `Up to ${formatter.format(salaryMax!)}${period}`;
}

export function getJobSalaryFields(job: {
  salaryMin?: unknown;
  salaryMax?: unknown;
  salaryCurrency?: string | null;
  metadata?: unknown;
}): JobSalaryFields {
  return {
    salaryMin: job.salaryMin != null ? Number(job.salaryMin) : null,
    salaryMax: job.salaryMax != null ? Number(job.salaryMax) : null,
    salaryCurrency: job.salaryCurrency,
    metadata: job.metadata,
    salaryPeriod: getSalaryPeriodFromMetadata(job.metadata),
  };
}

type JobDateFields = {
  postedAt?: Date | string | null;
  importedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

/** Website/API posted date when available; otherwise import or create time. */
export function resolveJobDisplayDate(job: JobDateFields): Date | null {
  for (const value of [job.postedAt, job.importedAt, job.createdAt]) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export const OPEN_JOB_ORDER = [
  { postedAt: { sort: "desc" as const, nulls: "last" as const } },
  { importedAt: { sort: "desc" as const, nulls: "last" as const } },
  { createdAt: "desc" as const },
];

