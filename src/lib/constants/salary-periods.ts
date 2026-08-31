export const SALARY_PERIODS = [
  { value: "hourly", label: "/hr" },
  { value: "monthly", label: "/month" },
  { value: "annual", label: "/annum" },
] as const;

export type SalaryPeriod = (typeof SALARY_PERIODS)[number]["value"];

export const DEFAULT_SALARY_PERIOD: SalaryPeriod = "annual";

export function parseSalaryPeriod(value: unknown): SalaryPeriod {
  if (value === "hourly" || value === "monthly" || value === "annual") return value;
  return DEFAULT_SALARY_PERIOD;
}

export function getSalaryPeriodFromMetadata(metadata: unknown): SalaryPeriod {
  if (!metadata || typeof metadata !== "object") return DEFAULT_SALARY_PERIOD;
  return parseSalaryPeriod((metadata as { salaryPeriod?: unknown }).salaryPeriod);
}
