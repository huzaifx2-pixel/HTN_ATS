import type { BooleanNode } from "./parse";

export type BooleanEvaluationResult = {
  passes: boolean;
  matchedTerms: string[];
  query: string;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Keep tech tokens like C#, C++, .NET, and node.js intact. */
export function normalizeBooleanText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^\w\s.+#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function termVariants(term: string): string[] {
  const normalized = normalizeBooleanText(term);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  variants.add(normalized.replace(/-/g, " "));
  variants.add(normalized.replace(/\s+/g, "-"));
  if (normalized.includes(".")) {
    variants.add(normalized.replace(/\./g, ""));
  }
  return [...variants].filter(Boolean);
}

function boundaryRegex(term: string): RegExp {
  const escaped = escapeRegex(term).replace(/\\[.\-]| /g, "[\\s.-]+");
  return new RegExp(`(?<![a-z0-9+#])${escaped}(?![a-z0-9+#])`, "i");
}

export function termMatches(corpus: string, term: string): boolean {
  const haystack = normalizeBooleanText(corpus);
  if (!haystack) return false;

  return termVariants(term).some((variant) => boundaryRegex(variant).test(haystack));
}

function collectMatchedTerms(
  node: BooleanNode,
  corpus: string,
  matched: Set<string>,
  positive: boolean,
): boolean {
  switch (node.type) {
    case "term": {
      const hit = termMatches(corpus, node.value);
      if (hit && positive) matched.add(node.value);
      return hit;
    }
    case "and":
      return (
        collectMatchedTerms(node.left, corpus, matched, positive) &&
        collectMatchedTerms(node.right, corpus, matched, positive)
      );
    case "or":
      return (
        collectMatchedTerms(node.left, corpus, matched, positive) ||
        collectMatchedTerms(node.right, corpus, matched, positive)
      );
    case "not":
      return !collectMatchedTerms(node.child, corpus, matched, !positive);
    default:
      return false;
  }
}

export function evaluateBooleanAst(ast: BooleanNode, corpus: string): BooleanEvaluationResult {
  const matchedTerms = new Set<string>();
  const passes = collectMatchedTerms(ast, corpus, matchedTerms, true);

  return {
    passes,
    matchedTerms: [...matchedTerms],
    query: "",
  };
}

export function evaluateBooleanSearch(
  ast: BooleanNode,
  corpus: string,
  query: string,
): BooleanEvaluationResult {
  const result = evaluateBooleanAst(ast, corpus);
  return { ...result, query };
}

function normalizeTitleKey(value: string) {
  return normalizeBooleanText(value)
    .replace(/\b(phd|sr|jr|senior|junior|lead|principal|staff|expert|specialist|based|remote)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nodeLooksLikeJobTitle(node: BooleanNode, jobTitle: string): boolean {
  const titleKey = normalizeTitleKey(jobTitle);
  if (!titleKey || titleKey.length < 4) return false;

  if (node.type === "term") {
    const termKey = normalizeTitleKey(node.value);
    if (!termKey) return false;
    return termKey === titleKey || titleKey.includes(termKey) || termKey.includes(titleKey);
  }
  if (node.type === "or") {
    return nodeLooksLikeJobTitle(node.left, jobTitle) || nodeLooksLikeJobTitle(node.right, jobTitle);
  }
  return false;
}

function titleTokenOrNode(jobTitle: string): BooleanNode | null {
  const stop = new Set([
    "phd",
    "sr",
    "jr",
    "senior",
    "junior",
    "lead",
    "principal",
    "staff",
    "expert",
    "specialist",
    "based",
    "remote",
    "the",
    "and",
    "or",
    "for",
    "with",
  ]);
  const tokens = normalizeBooleanText(jobTitle)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9.+#]/g, ""))
    .filter((token) => token.length > 3 && !stop.has(token));
  if (tokens.length === 0) return null;

  const terms = [...new Set(tokens)];
  for (let i = 0; i < tokens.length - 1; i++) {
    terms.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  const nodes: BooleanNode[] = terms.map((value) => ({
    type: "term",
    value,
    quoted: value.includes(" "),
  }));
  return nodes.reduce((left, right) => ({ type: "or", left, right }));
}

/**
 * Generated Booleans often require the exact job title phrase, which almost never
 * appears on resumes. Soften that clause to meaningful title tokens while keeping
 * the rest of the Boolean (skills, tools, location terms) required.
 */
export function withRelaxedJobTitleRequirement(ast: BooleanNode, jobTitle: string): BooleanNode {
  if (ast.type !== "and") return ast;

  if (nodeLooksLikeJobTitle(ast.left, jobTitle)) {
    const relaxedTitle = titleTokenOrNode(jobTitle);
    // Drop exact-title gate; keep skill/requirement side as the hard filter.
    if (!relaxedTitle) return ast.right;
    return { type: "and", left: relaxedTitle, right: ast.right };
  }

  // Generated queries are left-associative: (((title) AND skill1) AND skill2)...
  if (ast.left.type === "and") {
    return {
      type: "and",
      left: withRelaxedJobTitleRequirement(ast.left, jobTitle),
      right: ast.right,
    };
  }

  return ast;
}
