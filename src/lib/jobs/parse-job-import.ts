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

export type ImportedJobRowIssue = {
  rowNumber: number;
  reason: string;
  referralLink?: string;
  title?: string;
  clientName?: string;
};

export type ParsedJobImportDetailed = {
  rows: Array<ImportedJobRow & { rowNumber: number; referralKey: string }>;
  invalid: ImportedJobRowIssue[];
  duplicateReferralKeys: Array<{ referralKey: string; rows: number[] }>;
  totalRawRows: number;
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

export function normalizeReferralKey(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeClientName(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
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

function mapRecordPartial(record: Record<string, unknown>): Partial<ImportedJobRow> {
  const mapped: Partial<ImportedJobRow> = {};

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = normalizeHeader(rawKey);
    if (!key || key.startsWith("__empty_")) continue;
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

  return mapped;
}

function mapRecord(record: Record<string, unknown>): ImportedJobRow | null {
  const mapped = mapRecordPartial(record);
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

function classifyRecords(records: Record<string, unknown>[]): ParsedJobImportDetailed {
  const invalid: ImportedJobRowIssue[] = [];
  const candidates: Array<ImportedJobRow & { rowNumber: number; referralKey: string }> = [];
  const keyToRows = new Map<string, number[]>();

  records.forEach((record, index) => {
    const rowNumber = index + 2; // header is row 1
    const mapped = mapRecordPartial(record);
    const title = mapped.title?.trim() ?? "";
    const clientName = mapped.clientName?.trim();
    const clientPrefix = mapped.clientPrefix?.trim();
    const referralKey = normalizeReferralKey(mapped.referralLink);

    const isEmptyRow =
      !title &&
      !clientName &&
      !clientPrefix &&
      !referralKey &&
      !mapped.description &&
      !mapped.skills &&
      !mapped.pay;

    if (isEmptyRow) return;

    if (!referralKey) {
      invalid.push({
        rowNumber,
        reason: "Referral Link is required",
        title: title || undefined,
        clientName: clientName || clientPrefix,
      });
      return;
    }

    if (!title || (!clientName && !clientPrefix)) {
      invalid.push({
        rowNumber,
        reason: "Client and title are required",
        referralLink: referralKey,
        title: title || undefined,
        clientName: clientName || clientPrefix,
      });
      return;
    }

    const pay = parsePayRange(mapped.pay);
    const row: ImportedJobRow & { rowNumber: number; referralKey: string } = {
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
      referralLink: referralKey,
      rowNumber,
      referralKey,
    };

    candidates.push(row);
    const rows = keyToRows.get(referralKey) ?? [];
    rows.push(rowNumber);
    keyToRows.set(referralKey, rows);
  });

  const duplicateReferralKeys = [...keyToRows.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([referralKey, rows]) => ({ referralKey, rows }));

  const duplicateKeySet = new Set(duplicateReferralKeys.map((d) => d.referralKey));
  const rows = candidates.filter((row) => !duplicateKeySet.has(row.referralKey));

  for (const dup of duplicateReferralKeys) {
    for (const rowNumber of dup.rows) {
      invalid.push({
        rowNumber,
        reason: `Duplicate Referral Link in file (also on rows ${dup.rows.join(", ")})`,
        referralLink: dup.referralKey,
      });
    }
  }

  return {
    rows,
    invalid,
    duplicateReferralKeys,
    totalRawRows: records.length,
  };
}

function detectDelimiter(sample: string): string | undefined {
  const firstLine = sample.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const pipes = (firstLine.match(/\|/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const pipedNames = (firstLine.match(/\|[A-Za-z][^|]{0,40}\|/g) ?? []).length;

  if (pipedNames >= 2 && pipes >= tabs && pipes > commas) return "|";
  if (tabs >= pipes && tabs >= commas && tabs > 0) return "\t";
  if (pipes > commas && pipes > 0) return "|";
  return undefined;
}

function parseCsvRecords(text: string): Record<string, unknown>[] {
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
  return parsed.data;
}

export function parseJobCsvDetailed(text: string): ParsedJobImportDetailed {
  return classifyRecords(parseCsvRecords(text));
}

export function parseJobXlsxDetailed(buffer: ArrayBuffer): ParsedJobImportDetailed {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook has no sheets");
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return classifyRecords(data);
}

export function parseJobJsonDetailed(text: string): ParsedJobImportDetailed {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array of job objects");
  return classifyRecords(parsed.map((row) => (row ?? {}) as Record<string, unknown>));
}

export function parseJobCsv(text: string): ImportedJobRow[] {
  return parseJobCsvDetailed(text).rows;
}

export function parseJobXlsx(buffer: ArrayBuffer): ImportedJobRow[] {
  return parseJobXlsxDetailed(buffer).rows;
}

export function parseJobJson(text: string): ImportedJobRow[] {
  return parseJobJsonDetailed(text).rows;
}

export async function parseJobImportFileDetailed(
  file: File,
  format: string,
): Promise<ParsedJobImportDetailed> {
  const lower = file.name.toLowerCase();
  const resolved =
    lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? "xlsx"
      : lower.endsWith(".json")
        ? "json"
        : format || "csv";

  if (resolved === "json") return parseJobJsonDetailed(await file.text());
  if (resolved === "xlsx") return parseJobXlsxDetailed(await file.arrayBuffer());
  return parseJobCsvDetailed(await file.text());
}

export async function parseJobImportFile(file: File, format: string): Promise<ImportedJobRow[]> {
  return (await parseJobImportFileDetailed(file, format)).rows;
}
