import { createHash } from "node:crypto";

const TARGET_CHARS = 1800;
const OVERLAP_CHARS = 200;

export function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function chunkText(text: string, targetChars = TARGET_CHARS, overlapChars = OVERLAP_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  if (normalized.length <= targetChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    const piece = buffer.trim();
    if (piece) chunks.push(piece);
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;
    if (buffer.length + paragraph.length + 2 <= targetChars) {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (buffer) flush();
    if (paragraph.length <= targetChars) {
      buffer = paragraph;
      continue;
    }
    for (let i = 0; i < paragraph.length; i += targetChars - overlapChars) {
      chunks.push(paragraph.slice(i, i + targetChars).trim());
    }
  }
  flush();

  if (chunks.length <= 1) return chunks;

  return chunks.filter(Boolean);
}
