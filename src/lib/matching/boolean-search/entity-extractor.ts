import { CATALOG_DICTIONARY_TERMS, lookupCatalogTerm } from "./skill-catalog";
import { classifyEntity, stripStopPhrases, type EntityKind } from "./boolean-entities";
import { GENERIC_VERBS, isGenericVerb, isRejectedTerm, isSoftSkill, normalizeEntity } from "./skill-normalization";
import { isSentenceFragment } from "./quality";

export type RecruiterEntity = {
  term: string;
  kind: EntityKind;
  source: "required" | "preferred" | "dictionary" | "list";
  jdMentions: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
}

function countMentions(corpus: string, term: string): number {
  if (!corpus || !term) return 0;
  try {
    const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    return corpus.match(pattern)?.length ?? 0;
  } catch {
    return 0;
  }
}

function isValidEntity(term: string): boolean {
  if (isSentenceFragment(term)) return false;
  if (isSoftSkill(term) || isRejectedTerm(term)) return false;
  if (isGenericVerb(term)) return false;
  const lower = term.toLowerCase();
  if (GENERIC_VERBS.has(lower)) return false;
  return true;
}

function sourceRank(source: RecruiterEntity["source"]): number {
  switch (source) {
    case "required":
      return 3;
    case "preferred":
      return 2;
    case "dictionary":
      return 1;
    default:
      return 0;
  }
}

function addEntity(
  map: Map<string, RecruiterEntity>,
  raw: string,
  source: RecruiterEntity["source"],
  corpus: string,
) {
  const normalized = normalizeEntity(raw);
  if (!normalized || !isValidEntity(normalized)) return;

  const kind = lookupCatalogTerm(normalized)?.kind ?? classifyEntity(normalized);
  const key = normalized.toLowerCase();
  const jdMentions = countMentions(corpus, normalized);
  const existing = map.get(key);

  if (!existing) {
    map.set(key, { term: normalized, kind, source, jdMentions });
    return;
  }

  const nextSource = sourceRank(source) > sourceRank(existing.source) ? source : existing.source;
  map.set(key, {
    term: existing.term,
    kind: existing.kind,
    source: nextSource,
    jdMentions: Math.max(existing.jdMentions, jdMentions),
  });
}

function extractFromDictionary(text: string, map: Map<string, RecruiterEntity>, corpus: string) {
  const lower = text.toLowerCase();
  for (const entry of CATALOG_DICTIONARY_TERMS) {
    const pattern = new RegExp(`\\b${escapeRegex(entry)}\\b`, "i");
    if (pattern.test(lower)) {
      addEntity(map, entry, "dictionary", corpus);
    }
  }
}

function extractFromLists(text: string, map: Map<string, RecruiterEntity>, corpus: string) {
  if (!/[,;|\n•]/.test(text)) return;
  const listChunks = text.split(/[,;|\n•]+/);
  for (const chunk of listChunks) {
    const cleaned = chunk
      .replace(/^[-•*]\s*/, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length < 2 || cleaned.length > 40) continue;
    const wordCount = cleaned.split(/\s+/).length;
    if (wordCount > 4) continue;
    if (wordCount >= 3 && !lookupCatalogTerm(cleaned)) continue;
    addEntity(map, cleaned, "list", corpus);
  }
}

export function extractRecruiterEntities(input: {
  title?: string;
  description?: string | null;
  requirementsText?: string | null;
  preferredQualifications?: string | null;
  hintSkills?: string[];
  hintPreferredSkills?: string[];
  hintCertifications?: string[];
}): RecruiterEntity[] {
  const map = new Map<string, RecruiterEntity>();

  const corpus = [input.description, input.requirementsText, input.preferredQualifications]
    .filter(Boolean)
    .join("\n");
  const cleaned = stripStopPhrases(corpus);

  for (const skill of input.hintSkills ?? []) {
    addEntity(map, skill, "required", corpus);
  }
  for (const skill of input.hintPreferredSkills ?? []) {
    addEntity(map, skill, "preferred", corpus);
  }
  for (const cert of input.hintCertifications ?? []) {
    addEntity(map, cert, "required", corpus);
  }

  extractFromDictionary(cleaned, map, corpus);
  extractFromLists(cleaned, map, corpus);

  return [...map.values()].sort((a, b) => {
    const sourceDelta = sourceRank(b.source) - sourceRank(a.source);
    if (sourceDelta !== 0) return sourceDelta;
    return b.jdMentions - a.jdMentions;
  });
}

export function groupEntities(entities: RecruiterEntity[]) {
  const hardSkills: RecruiterEntity[] = [];
  const technologies: RecruiterEntity[] = [];
  const platforms: RecruiterEntity[] = [];
  const tools: RecruiterEntity[] = [];
  const certifications: RecruiterEntity[] = [];

  for (const entity of entities) {
    switch (entity.kind) {
      case "hard_skill":
        hardSkills.push(entity);
        break;
      case "technology":
        technologies.push(entity);
        break;
      case "platform":
        platforms.push(entity);
        break;
      case "tool":
        tools.push(entity);
        break;
      case "certification":
        certifications.push(entity);
        break;
    }
  }

  return { hardSkills, technologies, platforms, tools, certifications };
}
