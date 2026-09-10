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

const RATE_PERIOD_BY_SALARY: Record<SalaryPeriod, string> = {
  hourly: "Hour",
  monthly: "Month",
  annual: "Year",
};

export function ratePeriodFromSalaryPeriod(period: SalaryPeriod): string {
  return RATE_PERIOD_BY_SALARY[period];
}

export function getSalaryPeriodFromMetadata(metadata: unknown): SalaryPeriod {
  if (!metadata || typeof metadata !== "object") return DEFAULT_SALARY_PERIOD;
  return parseSalaryPeriod((metadata as { salaryPeriod?: unknown }).salaryPeriod);
}

export const SALARY_CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "INR", label: "INR (₹)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "EUR", label: "EUR (€)" },
] as const;

export type SalaryCurrency = (typeof SALARY_CURRENCIES)[number]["value"];

export const DEFAULT_SALARY_CURRENCY: SalaryCurrency = "USD";

export function parseSalaryCurrency(value: unknown): SalaryCurrency {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (code === "USD" || code === "INR" || code === "GBP" || code === "EUR") return code;
  if (code === "POUND" || code === "£") return "GBP";
  if (code === "EURO" || code === "€") return "EUR";
  return DEFAULT_SALARY_CURRENCY;
}
