import { isGenericVerb, isRejectedTerm, isSoftSkill } from "./skill-normalization";

const FRAGMENT_PATTERNS = [
  /^(and|or|not)\b/i,
  /\b(such as|for example|including|expertise in|experience with|responsible for|ability to)\b/i,
  /\b(for sharing|query history|analytical outcomes|warehouses?\)|\)\.?)$/i,
  /\.\s*$/,
  /^[^a-zA-Z0-9]+$/,
  /\b(and|or)\s+[A-Z]/,
];

export function isSentenceFragment(term: string): boolean {
  const t = term.trim();
  if (t.length < 2 || t.length > 45) return true;
  if (t.split(/\s+/).length > 4) return true;
  if (/[()]/.test(t) && t.length > 15) return true;
  if (/^(and|or|not)\s/i.test(t)) return true;
  for (const pattern of FRAGMENT_PATTERNS) {
    if (pattern.test(t)) return true;
  }
  if (t.split(/\s+/).length >= 3 && t === t.toLowerCase()) return true;
  return false;
}

export function isLowQualityTerm(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return true;
  if (isSentenceFragment(trimmed)) return true;
  if (isSoftSkill(trimmed) || isRejectedTerm(trimmed)) return true;
  if (isGenericVerb(trimmed)) return true;
  if (/\b(responsible for|ability to|experience with|manage assignments)\b/i.test(trimmed)) return true;
  return false;
}
