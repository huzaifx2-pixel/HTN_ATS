/**
 * Extended document text extraction: legacy .doc, RTF, and optional OCR for scanned PDFs.
 */

import { PDFParse } from "pdf-parse";
import { pathToFileURL } from "node:url";
import { getPdfWorkerPath } from "@/lib/runtime/paths";

let pdfWorkerConfigured = false;

function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
  PDFParse.setWorker(pathToFileURL(getPdfWorkerPath()).href);
  pdfWorkerConfigured = true;
}

export async function extractLegacyDocText(buffer: Buffer): Promise<string> {
  try {
    const WordExtractor = (await import("word-extractor")).default;
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return doc.getBody()?.trim() ?? "";
  } catch {
    return "";
  }
}

export function extractRtfText(buffer: Buffer): string {
  const raw = buffer.toString("utf-8");
  if (!raw.startsWith("{\\rtf")) {
    return "";
  }

  return raw
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\tab/gi, "\t")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isResumeOcrEnabled(): boolean {
  return process.env.RESUME_OCR_ENABLED === "true";
}

export async function ocrPdfText(buffer: Buffer, maxPages = 2): Promise<string> {
  if (!isResumeOcrEnabled()) {
    return "";
  }

  ensurePdfWorker();

  const OCR_TIMEOUT_MS = 45_000;

  function ocrWithTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${OCR_TIMEOUT_MS}ms`)),
        OCR_TIMEOUT_MS,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const chunks: string[] = [];

    try {
      const screenshots = await parser.getScreenshot({
        partial: Array.from({ length: maxPages }, (_, i) => i + 1),
        imageBuffer: true,
        scale: 2,
      });

      for (const page of screenshots.pages) {
        if (!page.data) continue;
        const { data } = await ocrWithTimeout(
          worker.recognize(Buffer.from(page.data)),
          "OCR page recognition",
        );
        if (data.text?.trim()) {
          chunks.push(data.text.trim());
        }
      }
    } finally {
      await worker.terminate();
      await parser.destroy();
    }

    return chunks.join("\n\n").trim();
  } catch (error) {
    console.warn("[ocr] PDF OCR failed:", error instanceof Error ? error.message : error);
    return "";
  }
}

export async function ocrImageText(buffer: Buffer): Promise<string> {
  if (!isResumeOcrEnabled()) {
    return "";
  }

  const OCR_TIMEOUT_MS = 45_000;
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await new Promise<{ data: { text?: string } }>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`OCR image timed out after ${OCR_TIMEOUT_MS}ms`)),
          OCR_TIMEOUT_MS,
        );
        worker.recognize(buffer).then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
      return result.data.text?.trim() ?? "";
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    console.warn("[ocr] Image OCR failed:", error instanceof Error ? error.message : error);
    return "";
  }
}

export function isLikelyResumeText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 80) return false;
  const signals = [
    /experience/i,
    /education/i,
    /skills/i,
    /resume|curriculum vitae/i,
    /@/,
    /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
    /linkedin/i,
  ];
  const hits = signals.filter((pattern) => pattern.test(trimmed)).length;
  return hits >= 2;
}
