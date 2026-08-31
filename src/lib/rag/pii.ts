import { createHash } from "node:crypto";
import { getRagConfig } from "@/lib/rag/config";
import type { RagSourceType } from "@/lib/rag/types";

function redactEmail(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
}

function redactPhone(value: string) {
  return value.replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
}

export function applyPiiPolicy(sourceType: RagSourceType, text: string) {
  const { piiMode } = getRagConfig();
  let next = text;
  if (piiMode === "summary" && sourceType === "resume") {
    next = redactEmail(redactPhone(next));
  }
  return next.trim();
}

export function stableId(prefix: string, ...parts: string[]) {
  const hash = createHash("sha1").update(parts.join(":")).digest("hex").slice(0, 16);
  return `${prefix}_${hash}`;
}
