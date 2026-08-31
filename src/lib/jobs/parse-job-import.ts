import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ImportedJobRow = {
  clientName?: string;
  clientPrefix?: string;
  title: string;
  description?: string;
  location?: string;
  skills?: string;
  experienceYears?: number;
  openings?: number;
  pay?: string;
  salaryMin?: number;
  salaryMax?: number;
  referralLink?: string;
};

const HEADER_MAP: Record<string, keyof ImportedJobRow> = {
  clientprefix: "clientPrefix",
  "client prefix": "clientPrefix",
  prefix: "clientPrefix",
  client: "clientName",
  "client name": "clientName",
  company: "clientName",
  title: "title",
  "job title": "title",
  jobtitle: "title",
  role: "title",
  description: "description",
  "job description": "description",
  location: "location",
  skills: "skills",
  skill: "skills",
  "required skills": "skills",
  "required skill": "skills",
  experienceyears: "experienceYears",
  "experience years": "experienceYears",
  experience: "experienceYears",
  openings: "openings",
  opening: "openings",
  headcount: "openings",
  pay: "pay",
  salary: "pay",
  compensation: "pay",
  "referral link": "referralLink",
  "refferal link": "referralLink",
  referral: "referralLink",
  refferal: "referralLink",
  applyurl: "referralLink",
  "apply url": "referralLink",
  applylink: "referralLink",
};

export const JOB_IMPORT_TEMPLATE_CSV = [
  "Client,title,Job Description,Openings,Required Skills,Pay,Refferal Link",
  'Acme,Software Engineer,"Build ATS features",1,"TypeScript, React","$90k-$110k",https://example.com/apply',
].join("\n");

function stripCellDecorations(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/^["'|]+|["'|]+$/g, "")
    .replace(/\|/g, " ")
    .trim();
}

function normalizeHeader(value: string): string {
  return stripCellDecorations(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function optionalText(value: unknown): string | undefined {
  const text = stripCellDecorations(String(value ?? ""));
  return text.length > 0 ? text : undefined;
}

function optionalInt(value: unknown): number | undefined {
  const text = stripCellDecorations(String(value ?? "")).replace(/,/g, "");
  if (!text) return undefined;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePayRange(value?: string): { salaryMin?: number; salaryMax?: number } {
  if (!value) return {};
  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(k)?/gi)];
  const amounts = matches.map((match) => {
    const amount = Number.parseFloat(match[1]);
    if (!Number.isFinite(amount)) return null;
    return match[2] ? Math.round(amount * 1000) : Math.round(amount);
  }).filter((amount): amount is number => amount !== null);

  if (amounts.length === 0) return {};
  if (amounts.length === 1) return { salaryMin: amounts[0] };
  return { salaryMin: Math.min(amounts[0], amounts[1]), salaryMax: Math.max(amounts[0], amounts[1]) };
}

function mapRecord(record: Record<string, unknown>): ImportedJobRow | null {
  const mapped: Partial<ImportedJobRow> = {};

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = normalizeHeader(rawKey);
    if (!key) continue;
    const field = HEADER_MAP[key];
    if (!field) continue;

    if (field === "experienceYears" || field === "openings") {
      const parsed = optionalInt(rawValue);
      if (parsed !== undefined) mapped[field] = parsed;
      continue;
    }

    const text = optionalText(rawValue);
    if (text) {
      switch (field) {
        case "clientName":
        case "clientPrefix":
        case "title":
        case "description":
        case "location":
        case "skills":
        case "pay":
        case "referralLink":
          mapped[field] = text;
          break;
      }
    }
  }

  const title = mapped.title?.trim() ?? "";
  const clientName = mapped.clientName?.trim();
  const clientPrefix = mapped.clientPrefix?.trim();
  if (!title || (!clientName && !clientPrefix)) return null;

  const pay = parsePayRange(mapped.pay);

  return {
    clientName,
    clientPrefix,
    title,
    description: mapped.description,
    location: mapped.location,
    skills: mapped.skills,
    experienceYears: mapped.experienceYears,
    openings: mapped.openings,
    pay: mapped.pay,
    salaryMin: pay.salaryMin,
    salaryMax: pay.salaryMax,
    referralLink: mapped.referralLink,
  };
}

function detectDelimiter(sample: string): string | undefined {
  const firstLine = sample.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const pipes = (firstLine.match(/\|/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const pipedNames = (firstLine.match(/\|[A-Za-z][^|]{0,40}\|/g) ?? []).length;

  // "|Client|  title  |Job Description|  |Openings|" — pipes wrap names, tabs are padding.
  if (pipedNames >= 2 && pipes >= tabs && pipes > commas) return "|";
  if (tabs >= pipes && tabs >= commas && tabs > 0) return "\t";
  if (pipes > commas && pipes > 0) return "|";
  return undefined;
}

export function parseJobCsv(text: string): ImportedJobRow[] {
  let emptyHeaderIndex = 0;
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: detectDelimiter(text) ?? "",
    transformHeader: (header) => {
      const key = normalizeHeader(header);
      if (!key) return `__empty_${emptyHeaderIndex++}`;
      return key;
    },
  });

  return parsed.data
    .map(mapRecord)
    .filter((row): row is ImportedJobRow => row !== null);
}

export function parseJobXlsx(buffer: ArrayBuffer): ImportedJobRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook has no sheets");
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return data.map(mapRecord).filter((row): row is ImportedJobRow => row !== null);
}

export function parseJobJson(text: string): ImportedJobRow[] {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array of job objects");
  return parsed
    .map((row) => mapRecord((row ?? {}) as Record<string, unknown>))
    .filter((row): row is ImportedJobRow => row !== null);
}

export async function parseJobImportFile(file: File, format: string): Promise<ImportedJobRow[]> {
  const lower = file.name.toLowerCase();
  const resolved =
    lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? "xlsx"
      : lower.endsWith(".json")
        ? "json"
        : format || "csv";

  if (resolved === "json") return parseJobJson(await file.text());
  if (resolved === "xlsx") return parseJobXlsx(await file.arrayBuffer());
  return parseJobCsv(await file.text());
}
