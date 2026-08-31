import { parseBooleanQuery, type BooleanNode } from "@/lib/matching/boolean-search/parse";

const MAX_TERMS = 32;

function formatTerm(value: string, quoted: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (quoted || /\s/.test(trimmed)) return `"${trimmed.replace(/"/g, "")}"`;
  return trimmed;
}

function astToGoogle(node: BooleanNode, budget: { remaining: number }): string {
  if (budget.remaining <= 0) return "";

  switch (node.type) {
    case "term": {
      budget.remaining -= 1;
      return formatTerm(node.value, node.quoted);
    }
    case "not": {
      const inner = astToGoogle(node.child, budget);
      return inner ? `-${inner}` : "";
    }
    case "or": {
      const left = astToGoogle(node.left, budget);
      const right = astToGoogle(node.right, budget);
      if (left && right) return `(${left} OR ${right})`;
      return left || right;
    }
    case "and": {
      const left = astToGoogle(node.left, budget);
      const right = astToGoogle(node.right, budget);
      return [left, right].filter(Boolean).join(" ");
    }
    default:
      return "";
  }
}

export function collectBooleanTerms(node: BooleanNode, out: string[] = []): string[] {
  switch (node.type) {
    case "term":
      if (node.value.trim()) out.push(node.value.trim());
      break;
    case "not":
      collectBooleanTerms(node.child, out);
      break;
    default:
      collectBooleanTerms(node.left, out);
      collectBooleanTerms(node.right, out);
  }
  return out;
}

export function booleanToLinkedInXray(
  booleanSearch: string,
  extras?: { city?: string | null; country?: string | null; location?: string | null }
) {
  const parsed = parseBooleanQuery(booleanSearch);
  const parts = ["site:linkedin.com/in"];

  if (parsed.ok) {
    const budget = { remaining: MAX_TERMS };
    const converted = astToGoogle(parsed.ast, budget).trim();
    if (converted) parts.push(converted);
  } else {
    const fallback = booleanSearch
      .replace(/\bAND\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (fallback) parts.push(fallback);
  }

  const locationBits = [extras?.city, extras?.location, extras?.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (locationBits[0] && !parts.join(" ").toLowerCase().includes(locationBits[0].toLowerCase())) {
    parts.push(`"${locationBits[0].replace(/"/g, "")}"`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function booleanTermList(booleanSearch: string): string[] {
  const parsed = parseBooleanQuery(booleanSearch);
  if (!parsed.ok) {
    return booleanSearch
      .split(/\b(?:AND|OR|NOT)\b/i)
      .map((part) => part.replace(/[()]/g, "").trim())
      .filter(Boolean)
      .slice(0, MAX_TERMS);
  }
  return collectBooleanTerms(parsed.ast).slice(0, MAX_TERMS);
}
