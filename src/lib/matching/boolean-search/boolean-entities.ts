import type { EntityKind } from "./types";
import { lookupCatalogTerm } from "./skill-catalog";

/** Phrases stripped before entity extraction. */
export const STOP_PHRASES: RegExp[] = [
  /\bsuch as\b/gi,
  /\bincluding\b/gi,
  /\bfor example\b/gi,
  /\bexperience in\b/gi,
  /\bexperience with\b/gi,
  /\bexpertise in\b/gi,
  /\bworking knowledge of\b/gi,
  /\bfamiliarity with\b/gi,
  /\bresponsible for\b/gi,
  /\bpreferred qualifications\b/gi,
  /\bminimum requirements\b/gi,
  /\bqualifications\b/gi,
  /\brequirements\b/gi,
  /\bability to\b/gi,
  /\bdemonstrated proficiency in\b/gi,
  /\bproficiency in\b/gi,
  /\bknowledge of\b/gi,
  /\bstrong understanding of\b/gi,
  /\bhands[- ]on experience with\b/gi,
  /\butilize\b/gi,
  /\busing\b/gi,
  /\bwith experience\b/gi,
];

export type { EntityKind };

export function classifyEntity(term: string): EntityKind {
  const catalog = lookupCatalogTerm(term);
  if (catalog) return catalog.kind;
  if (/\b(certified|certificate|cissp|cisa|cism|pmp|cpa|cfa)\b/i.test(term)) return "certification";
  return "hard_skill";
}

export function stripStopPhrases(text: string): string {
  let result = text;
  for (const pattern of STOP_PHRASES) {
    result = result.replace(pattern, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}
