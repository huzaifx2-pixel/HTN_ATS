export type FieldSource = "resume" | "ocr" | "email" | "linkedin" | "inferred" | "manual" | "api" | "html" | "csv";

/** New in parser 3.0 — recruiter review state (TDD 17). */
export type ReviewStatus = "auto" | "needs_review" | "approved" | "corrected";

/** New in parser 3.0 — how the value was produced (TDD 18). */
export type ExtractionMethod = "layout" | "regex" | "ocr" | "inferred" | "manual";

export interface ParsedField<T = string> {
  value: T;
  confidence: number;
  source: FieldSource;
  evidence?: string;
  line?: number;
  section?: string;
  normalized?: boolean;
  validated?: boolean;
  raw?: string;
  lastUpdated?: string;
  reviewStatus?: ReviewStatus;
  extractionMethod?: ExtractionMethod;
  page?: number;
  blockId?: string;
}

export function field<T>(
  value: T,
  opts: {
    confidence?: number;
    source?: FieldSource;
    evidence?: string;
    line?: number;
    section?: string;
    normalized?: boolean;
    validated?: boolean;
    raw?: string;
    reviewStatus?: ReviewStatus;
    extractionMethod?: ExtractionMethod;
    page?: number;
    blockId?: string;
  } = {}
): ParsedField<T> {
  const confidence = opts.confidence ?? 0.7;
  return {
    value,
    confidence,
    source: opts.source ?? "resume",
    evidence: opts.evidence,
    line: opts.line,
    section: opts.section,
    normalized: opts.normalized ?? false,
    validated: opts.validated ?? false,
    raw: opts.raw,
    lastUpdated: new Date().toISOString(),
    reviewStatus: opts.reviewStatus ?? (confidence < 0.6 ? "needs_review" : "auto"),
    extractionMethod: opts.extractionMethod ?? "regex",
    page: opts.page,
    blockId: opts.blockId,
  };
}

export function fieldValue<T>(f: ParsedField<T> | undefined | null): T | undefined {
  if (!f) return undefined;
  return f.value;
}

export function highConfidence<T>(f: ParsedField<T> | undefined, min = 0.5): T | undefined {
  if (!f || f.confidence < min) return undefined;
  return f.value;
}

export function isProtectedReviewStatus(status?: string | null): boolean {
  return status === "corrected" || status === "approved";
}
