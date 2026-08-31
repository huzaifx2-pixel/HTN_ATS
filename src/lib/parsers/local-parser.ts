import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { getPdfWorkerPath } from "@/lib/runtime/paths";
import type { ResumeParserAdapter, ParsedResumeResult } from "./types";
import { sanitizePostgresText } from "@/lib/sanitize-postgres";
import {
  extractLegacyDocText,
  extractRtfText,
  isResumeOcrEnabled,
} from "./document-extract";
import { reconstructPdfReadingOrder } from "./pdf-layout";
import { runParsePipeline, structuredToLegacyResult } from "./pipeline/run-pipeline";
import type { ExtractionMethod } from "./pipeline/parsed-field";

let pdfWorkerConfigured = false;

function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
  PDFParse.setWorker(pathToFileURL(getPdfWorkerPath()).href);
  pdfWorkerConfigured = true;
}

function fingerprintBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function extractPdfLayout(buffer: Buffer): Promise<{
  text: string;
  extractionMethod: ExtractionMethod;
  pageCount: number;
}> {
  ensurePdfWorker();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({
      lineEnforce: true,
      cellSeparator: "\t",
      pageJoiner: "",
    });
    const pages = result.pages?.length
      ? result.pages.map((page) => ({ num: page.num, text: page.text ?? "" }))
      : [{ num: 1, text: result.text ?? "" }];
    const reconstructed = reconstructPdfReadingOrder(pages);
    return {
      text: reconstructed.text,
      extractionMethod: reconstructed.extractionMethod,
      pageCount: reconstructed.pageCount || pages.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF text extraction failed: ${message}`);
  } finally {
    await parser.destroy();
  }
}

async function extractPdfWithOcr(buffer: Buffer): Promise<{
  text: string;
  ocrUsed: boolean;
  extractionMethod: ExtractionMethod;
  pageCount?: number;
}> {
  let rawText = "";
  let extractionMethod: ExtractionMethod = "regex";
  let pageCount: number | undefined;
  try {
    const layout = await extractPdfLayout(buffer);
    rawText = layout.text;
    extractionMethod = layout.extractionMethod;
    pageCount = layout.pageCount;
  } catch {
    rawText = "";
  }
  let ocrUsed = false;

  async function tryOcr(): Promise<string> {
    if (!isResumeOcrEnabled()) return "";
    const { ocrPdfText } = await import("./document-extract");
    return ocrPdfText(buffer);
  }

  if ((!rawText || rawText.length < 200) && !rawText.startsWith("%PDF-")) {
    const ocrText = await tryOcr();
    if (ocrText) {
      rawText = ocrText;
      ocrUsed = true;
      extractionMethod = "ocr";
    }
  }

  if (!rawText || rawText.startsWith("%PDF-")) {
    const ocrText = await tryOcr();
    if (ocrText) {
      rawText = ocrText;
      ocrUsed = true;
      extractionMethod = "ocr";
    } else {
      throw new Error(
        "Could not extract text from this PDF. It may be a scanned image — remove it from the queue or upload a text-based PDF.",
      );
    }
  }

  return { text: rawText, ocrUsed, extractionMethod, pageCount };
}

export class LocalResumeParser implements ResumeParserAdapter {
  async parse(buffer: Buffer, mimeType: string, fileName?: string): Promise<ParsedResumeResult> {
    let rawText = "";
    let ocrUsed = false;
    let extractionMethod: ExtractionMethod = "regex";
    let pageCount: number | undefined;
    const fingerprint = fingerprintBuffer(buffer);
    const lowerName = fileName?.toLowerCase() ?? "";
    const isDocx =
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx");
    const isLegacyDoc =
      mimeType === "application/msword" || (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx"));
    const isRtf =
      mimeType === "application/rtf" || mimeType === "text/rtf" || lowerName.endsWith(".rtf");
    const isImage =
      mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(lowerName);

    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
      const result = await extractPdfWithOcr(buffer);
      rawText = result.text;
      ocrUsed = result.ocrUsed;
      extractionMethod = result.extractionMethod;
      pageCount = result.pageCount;
    } else if (isImage) {
      const { ocrImageText } = await import("./document-extract");
      rawText = await ocrImageText(buffer);
      if (!rawText.trim()) {
        throw new Error(
          "Could not extract text from this image. Enable OCR (RESUME_OCR_ENABLED=true) or upload a text-based resume.",
        );
      }
      ocrUsed = true;
      extractionMethod = "ocr";
    } else if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (isLegacyDoc) {
      rawText = await extractLegacyDocText(buffer);
      if (!rawText.trim()) throw new Error("Could not extract text from legacy .doc file.");
    } else if (isRtf) {
      rawText = extractRtfText(buffer);
      if (!rawText.trim()) throw new Error("Could not extract text from RTF file.");
    } else {
      rawText = buffer.toString("utf-8");
      if (rawText.startsWith("%PDF-")) {
        const result = await extractPdfWithOcr(buffer);
        rawText = result.text;
        ocrUsed = result.ocrUsed;
        extractionMethod = result.extractionMethod;
        pageCount = result.pageCount;
      }
    }

    rawText = sanitizePostgresText(rawText) ?? "";

    const structured = runParsePipeline({
      rawText,
      mimeType,
      fileName,
      ocrUsed,
      fingerprint,
      extractionMethod,
      pageCount,
    });

    return structuredToLegacyResult(structured) as ParsedResumeResult;
  }
}
