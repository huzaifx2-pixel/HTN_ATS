import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ImportedContactRow = {
  email: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  company?: string;
};

export type ParsedContactImport = {
  rows: ImportedContactRow[];
  skipped: number;
  errors: string[];
};

const HEADER_MAP: Record<string, keyof Omit<ImportedContactRow, "email">> = {
  "contact name": "contactName",
  contactname: "contactName",
  name: "contactName",
  "first name": "firstName",
  firstname: "firstName",
  first: "firstName",
  "last name": "lastName",
  lastname: "lastName",
  last: "lastName",
  title: "title",
  "job title": "title",
  jobtitle: "title",
  department: "department",
  dept: "department",
  company: "company",
  organization: "company",
  employer: "company",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function mapRecord(record: Record<string, unknown>): ImportedContactRow | null {
  const mapped: Partial<ImportedContactRow> = {};

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = normalizeHeader(rawKey);
    if (key === "email" || key === "email address") {
      const email = normalizeEmail(rawValue);
      if (email) mapped.email = email;
      continue;
    }
    const field = HEADER_MAP[key];
    if (!field) continue;
    const value = String(rawValue ?? "").trim();
    if (value) mapped[field] = value;
  }

  if (!mapped.email) return null;

  if (!mapped.contactName && (mapped.firstName || mapped.lastName)) {
    mapped.contactName = `${mapped.firstName ?? ""} ${mapped.lastName ?? ""}`.trim();
  }
  if (!mapped.firstName && mapped.contactName) {
    const parts = mapped.contactName.split(/\s+/);
    mapped.firstName = parts[0];
    if (parts.length > 1) mapped.lastName = parts.slice(1).join(" ");
  }

  return {
    email: mapped.email,
    contactName: mapped.contactName,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    title: mapped.title,
    department: mapped.department,
    company: mapped.company,
  };
}

function dedupeRows(rows: ImportedContactRow[]): ParsedContactImport {
  const seen = new Set<string>();
  const unique: ImportedContactRow[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (seen.has(row.email)) {
      skipped += 1;
      continue;
    }
    seen.add(row.email);
    unique.push(row);
  }

  return { rows: unique, skipped, errors: [] };
}

export function parseContactCsv(text: string): ParsedContactImport {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeHeader(header),
  });

  const errors = parsed.errors.slice(0, 5).map((e) => e.message);
  const rows = parsed.data
    .map(mapRecord)
    .filter((row): row is ImportedContactRow => row !== null);

  const result = dedupeRows(rows);
  return { ...result, errors: [...errors, ...result.errors] };
}

export function parseContactXlsx(buffer: ArrayBuffer): ParsedContactImport {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { rows: [], skipped: 0, errors: ["Workbook has no sheets"] };
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rows = data.map(mapRecord).filter((row): row is ImportedContactRow => row !== null);
  return dedupeRows(rows);
}

export async function parseContactImportFile(file: File): Promise<ParsedContactImport> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseContactCsv(await file.text());
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseContactXlsx(await file.arrayBuffer());
  }
  throw new Error("Unsupported file type. Upload a .csv or .xlsx file.");
}

export const CONTACT_IMPORT_TEMPLATE_HEADERS = [
  "Contact Name",
  "First Name",
  "Last Name",
  "Title",
  "Department",
  "Email",
  "Company",
];
