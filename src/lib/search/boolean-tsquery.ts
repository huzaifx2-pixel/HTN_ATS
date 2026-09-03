import { parseBooleanQuery, type BooleanNode } from "@/lib/matching/boolean-search/parse";

const LEXEME = /[^a-z0-9]+/g;

function lexeme(value: string): string | null {
  const token = value
    .toLowerCase()
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(LEXEME, "")
    .slice(0, 32);
  return token.length >= 2 ? token : token.length === 1 && /[crj]/i.test(token) ? token : null;
}

function phraseQuery(value: string): string | null {
  const parts = value.split(/\s+/).map(lexeme).filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  if (parts.length === 1) return `${parts[0]}:*`;
  return `(${parts.map((part) => `${part}:*`).join(" <-> ")})`;
}

function astToTsquery(node: BooleanNode): string | null {
  if (node.type === "term") {
    return node.quoted ? phraseQuery(node.value) : phraseQuery(node.value);
  }
  if (node.type === "not") {
    const child = astToTsquery(node.child);
    return child ? `!${child}` : null;
  }
  const left = astToTsquery(node.left);
  const right = astToTsquery(node.right);
  if (!left) return right;
  if (!right) return left;
  const op = node.type === "or" ? "|" : "&";
  return `(${left} ${op} ${right})`;
}

export function booleanQueryToTsquery(query: string): { ok: true; tsquery: string } | { ok: false; error: string } {
  const parsed = parseBooleanQuery(query);
  if (!parsed.ok) return { ok: false, error: parsed.error.message };
  const tsquery = astToTsquery(parsed.ast);
  if (!tsquery) return { ok: false, error: "Boolean query produced no searchable terms" };
  return { ok: true, tsquery };
}

export function plainQueryToTsquery(query: string): string | null {
  const parts = query
    .split(/\s+/)
    .map(lexeme)
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return parts.map((part) => `${part}:*`).join(" & ");
}

/** Broad discovery query: any listed term is enough to retrieve. */
export function termsToOrTsquery(terms: string[]): string | null {
  const parts = [...new Set(terms.flatMap((term) => term.split(/\s+/).map(lexeme)).filter((part): part is string => Boolean(part)))];
  if (parts.length === 0) return null;
  return parts.slice(0, 32).map((part) => `${part}:*`).join(" | ");
}
