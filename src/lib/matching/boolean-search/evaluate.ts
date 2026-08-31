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
