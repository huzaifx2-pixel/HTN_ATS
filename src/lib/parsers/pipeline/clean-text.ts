export function cleanResumeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

export function estimatePageCount(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 350));
}

export function detectLanguage(text: string): string {
  if (/\b(the|and|experience|skills|education)\b/i.test(text)) return "en";
  return "en";
}
