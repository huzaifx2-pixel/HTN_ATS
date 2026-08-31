const HTML_ENTITY: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanJobText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function buildJobCorpus(input: {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
  preferredQualifications?: string | null;
  benefits?: string | null;
  summary?: string | null;
}): string {
  const parts: string[] = [input.title.trim()];

  const description =
    input.description?.trim() ||
    (input.descriptionHtml ? stripHtml(input.descriptionHtml) : "");
  if (description) parts.push(description);
  if (input.summary?.trim()) parts.push(input.summary.trim());
  if (input.responsibilities?.trim()) parts.push(input.responsibilities.trim());
  if (input.requirementsText?.trim()) parts.push(input.requirementsText.trim());
  if (input.preferredQualifications?.trim()) parts.push(input.preferredQualifications.trim());
  if (input.benefits?.trim()) parts.push(input.benefits.trim());

  return cleanJobText(parts.join("\n\n"));
}

export function detectJobLanguage(text: string): string {
  if (/\b(the|and|requirements|experience|skills|responsibilities)\b/i.test(text)) return "en";
  return "en";
}
