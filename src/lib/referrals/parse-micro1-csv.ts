import Papa from "papaparse";
import { createHash } from "crypto";
import { identityKeyFromNameAndDate, normalizePersonName } from "./name-match";

export type Micro1CsvRow = {
  rowNumber: number;
  csvName: string;
  normalizedName: string;
  identityKey: string;
  dateReferred: Date | null;
  projectType: string | null;
  tasksCompleted: number | null;
  hoursWorked: number | null;
  payoutAmount: number | null;
  transactionId: string | null;
  csvStatus: string;
  referrer: string | null;
  externalId: string | null;
};

export type Micro1InvalidRow = {
  rowNumber: number;
  reason: string;
  csvName?: string;
};

export type ParsedMicro1Csv = {
  fileHash: string;
  totalRows: number;
  valid: Micro1CsvRow[];
  invalid: Micro1InvalidRow[];
  duplicateRows: Micro1InvalidRow[];
  missingHeaders: string[];
};

const HEADER_MAP: Record<string, string> = {
  "candidate name": "csvName",
  name: "csvName",
  candidate: "csvName",
  "date referred": "dateReferred",
  "referred date": "dateReferred",
  "referral date": "dateReferred",
  "project type": "projectType",
  project: "projectType",
  "total tasks completed": "tasksCompleted",
  "tasks completed": "tasksCompleted",
  tasks: "tasksCompleted",
  "total hours worked": "hoursWorked",
  "hours worked": "hoursWorked",
  hours: "hoursWorked",
  "payout amount": "payoutAmount",
  payout: "payoutAmount",
  earnings: "payoutAmount",
  "transaction id": "transactionId",
  transaction: "transactionId",
  "txn id": "transactionId",
  status: "csvStatus",
  referrer: "referrer",
  recruiter: "referrer",
  "candidate id": "externalId",
  "micro1 id": "externalId",
  "micro1 candidate id": "externalId",
};

const REQUIRED_FIELDS = ["csvName", "csvStatus"] as const;

function stripCell(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/^["']+|["']+$/g, "").trim();
}

function normalizeHeader(value: string): string {
  return stripCell(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function hashFileBytes(bytes: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseNumber(value: string, field: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const text = value.replace(/[$,]/g, "").trim();
  if (!text) return { ok: true, value: null };
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return { ok: false, reason: `${field} is not a valid number` };
  return { ok: true, value: parsed };
}

function parseDate(value: string): { ok: true; value: Date | null } | { ok: false; reason: string } {
  const text = value.trim();
  if (!text) return { ok: true, value: null };
  const parsed = new Date(text.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return { ok: false, reason: "Date Referred is not a valid date" };
  return { ok: true, value: parsed };
}

export function parseMicro1ReferralCsv(content: string, fileBytes?: Buffer | Uint8Array | string): ParsedMicro1Csv {
  const fileHash = hashFileBytes(fileBytes ?? content);
  const parsed = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });

  const headerKeys = (parsed.meta.fields ?? []).map(normalizeHeader);
  const mappedHeaders = new Set(headerKeys.map((h) => HEADER_MAP[h]).filter(Boolean));
  const missingHeaders: string[] = [];
  if (!mappedHeaders.has("csvName")) missingHeaders.push("Candidate Name");
  if (!mappedHeaders.has("csvStatus")) missingHeaders.push("Status");

  if (missingHeaders.length > 0) {
    return {
      fileHash,
      totalRows: 0,
      valid: [],
      invalid: [{ rowNumber: 0, reason: `Missing required headers: ${missingHeaders.join(", ")}` }],
      duplicateRows: [],
      missingHeaders,
    };
  }

  const invalid: Micro1InvalidRow[] = [];
  const duplicateRows: Micro1InvalidRow[] = [];
  const valid: Micro1CsvRow[] = [];
  const seenKeys = new Map<string, number>();

  (parsed.data ?? []).forEach((record, index) => {
    const rowNumber = index + 2;
    const mapped: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(record ?? {})) {
      const field = HEADER_MAP[normalizeHeader(rawKey)];
      if (!field) continue;
      mapped[field] = stripCell(String(rawValue ?? ""));
    }

    const csvName = mapped.csvName?.trim() ?? "";
    if (!csvName) {
      invalid.push({ rowNumber, reason: "Candidate Name is empty" });
      return;
    }

    const csvStatus = mapped.csvStatus?.trim() ?? "";
    if (!csvStatus && REQUIRED_FIELDS.includes("csvStatus")) {
      invalid.push({ rowNumber, csvName, reason: "Status is empty" });
      return;
    }

    const date = parseDate(mapped.dateReferred ?? "");
    if (!date.ok) {
      invalid.push({ rowNumber, csvName, reason: date.reason });
      return;
    }
    if (!date.value) {
      invalid.push({ rowNumber, csvName, reason: "Date Referred is required (unique identifier)" });
      return;
    }
    const tasks = parseNumber(mapped.tasksCompleted ?? "", "Total Tasks Completed");
    if (!tasks.ok) {
      invalid.push({ rowNumber, csvName, reason: tasks.reason });
      return;
    }
    const hours = parseNumber(mapped.hoursWorked ?? "", "Total Hours Worked");
    if (!hours.ok) {
      invalid.push({ rowNumber, csvName, reason: hours.reason });
      return;
    }
    const payout = parseNumber(mapped.payoutAmount ?? "", "Payout Amount");
    if (!payout.ok) {
      invalid.push({ rowNumber, csvName, reason: payout.reason });
      return;
    }

    const normalizedName = normalizePersonName(csvName);
    if (!normalizedName) {
      invalid.push({ rowNumber, csvName, reason: "Candidate Name could not be normalized" });
      return;
    }

    const identityKey = identityKeyFromNameAndDate(normalizedName, date.value);
    const prior = seenKeys.get(identityKey);
    if (prior) {
      duplicateRows.push({
        rowNumber,
        csvName,
        reason: `Duplicate of row ${prior} (same name and Date Referred)`,
      });
      return;
    }
    seenKeys.set(identityKey, rowNumber);

    valid.push({
      rowNumber,
      csvName,
      normalizedName,
      identityKey,
      dateReferred: date.value,
      projectType: mapped.projectType?.trim() || null,
      tasksCompleted: tasks.value,
      hoursWorked: hours.value,
      payoutAmount: payout.value,
      transactionId: mapped.transactionId?.trim() || null,
      csvStatus,
      referrer: mapped.referrer?.trim() || null,
      externalId: mapped.externalId?.trim() || null,
    });
  });

  return {
    fileHash,
    totalRows: (parsed.data ?? []).length,
    valid,
    invalid,
    duplicateRows,
    missingHeaders: [],
  };
}

export function formatValidationSummary(parsed: ParsedMicro1Csv): string {
  const invalidCount = parsed.invalid.length + parsed.duplicateRows.length;
  return `${parsed.totalRows} rows found · ${parsed.valid.length} valid · ${invalidCount} invalid`;
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function serializeMicro1Csv(rows: Array<{
  csvName: string;
  dateReferred: Date | null;
  projectType: string | null;
  tasksCompleted: number | null;
  hoursWorked: number | null;
  payoutAmount: number | null;
  transactionId: string | null;
  csvStatus: string;
}>): string {
  const header =
    "Candidate Name,Date Referred,Project Type,Total Tasks Completed,Total Hours Worked,Payout Amount,Transaction ID,Status";
  const lines = rows.map((row) =>
    [
      csvCell(row.csvName),
      csvCell(row.dateReferred ? row.dateReferred.toISOString() : ""),
      csvCell(row.projectType),
      csvCell(row.tasksCompleted),
      csvCell(row.hoursWorked),
      csvCell(row.payoutAmount),
      csvCell(row.transactionId),
      csvCell(row.csvStatus),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

