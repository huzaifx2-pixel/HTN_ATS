export type BooleanNode =
  | { type: "term"; value: string; quoted: boolean }
  | { type: "and"; left: BooleanNode; right: BooleanNode }
  | { type: "or"; left: BooleanNode; right: BooleanNode }
  | { type: "not"; child: BooleanNode };

export type BooleanParseError = {
  message: string;
  position?: number;
};

export type BooleanParseResult =
  | { ok: true; ast: BooleanNode }
  | { ok: false; error: BooleanParseError };

type Token =
  | { type: "word"; value: string; start: number }
  | { type: "phrase"; value: string; start: number }
  | { type: "and"; start: number }
  | { type: "or"; start: number }
  | { type: "not"; start: number }
  | { type: "lparen"; start: number }
  | { type: "rparen"; start: number }
  | { type: "eof"; start: number };

const OPERATORS = new Set(["AND", "OR", "NOT"]);

function tokenize(query: string): Token[] | BooleanParseError {
  const tokens: Token[] = [];
  let i = 0;

  while (i < query.length) {
    const ch = query[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '"') {
      const start = i;
      i += 1;
      let value = "";
      while (i < query.length && query[i] !== '"') {
        value += query[i];
        i += 1;
      }
      if (query[i] !== '"') {
        return { message: "Unclosed quote in boolean search", position: start };
      }
      i += 1;
      if (!value.trim()) {
        return { message: "Empty phrase in boolean search", position: start };
      }
      tokens.push({ type: "phrase", value: value.trim(), start });
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", start: i });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen", start: i });
      i += 1;
      continue;
    }

    const start = i;
    while (i < query.length && !/\s/.test(query[i]) && !"\"()".includes(query[i])) {
      i += 1;
    }
    const raw = query.slice(start, i);
    if (!raw) {
      return { message: "Unexpected character in boolean search", position: start };
    }

    const upper = raw.toUpperCase();
    if (OPERATORS.has(upper)) {
      tokens.push({ type: upper.toLowerCase() as "and" | "or" | "not", start });
    } else if (raw === "+" || raw === "&") {
      tokens.push({ type: "and", start });
    } else if (raw === "|") {
      tokens.push({ type: "or", start });
    } else if (raw.length > 1 && raw.startsWith("-") && raw !== "--") {
      tokens.push({ type: "not", start });
      tokens.push({ type: "word", value: raw.slice(1), start: start + 1 });
    } else {
      tokens.push({ type: "word", value: raw, start });
    }
  }

  tokens.push({ type: "eof", start: query.length });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): BooleanNode | BooleanParseError {
    const expr = this.parseOr();
    if ("message" in expr) return expr;
    if (this.peek().type !== "eof") {
      const token = this.peek();
      return { message: `Unexpected token near position ${token.start}`, position: token.start };
    }
    return expr;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { type: "eof", start: 0 };
  }

  private consume(): Token {
    return this.tokens[this.index++] ?? { type: "eof", start: 0 };
  }

  private parseOr(): BooleanNode | BooleanParseError {
    let left = this.parseAnd();
    if ("message" in left) return left;

    while (this.peek().type === "or") {
      this.consume();
      const right = this.parseAnd();
      if ("message" in right) return right;
      left = { type: "or", left, right };
    }

    return left;
  }

  private parseAnd(): BooleanNode | BooleanParseError {
    let left = this.parseNot();
    if ("message" in left) return left;

    while (true) {
      const next = this.peek();
      if (next.type === "and") {
        this.consume();
      } else if (this.isFactorStart(next)) {
        // Implicit AND between adjacent terms, e.g. "React NOT junior"
      } else {
        break;
      }

      const right = this.parseNot();
      if ("message" in right) return right;
      left = { type: "and", left, right };
    }

    return left;
  }

  private isFactorStart(token: Token): boolean {
    return (
      token.type === "word" ||
      token.type === "phrase" ||
      token.type === "lparen" ||
      token.type === "not"
    );
  }

  private parseNot(): BooleanNode | BooleanParseError {
    if (this.peek().type === "not") {
      this.consume();
      const child = this.parseNot();
      if ("message" in child) return child;
      return { type: "not", child };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): BooleanNode | BooleanParseError {
    const token = this.peek();

    if (token.type === "phrase" || token.type === "word") {
      this.consume();
      return { type: "term", value: token.value, quoted: token.type === "phrase" };
    }

    if (token.type === "lparen") {
      this.consume();
      const inner = this.parseOr();
      if ("message" in inner) return inner;
      if (this.peek().type !== "rparen") {
        return { message: "Missing closing parenthesis", position: this.peek().start };
      }
      this.consume();
      return inner;
    }

    return { message: "Expected search term or '('", position: token.start };
  }
}

export function parseBooleanQuery(query: string): BooleanParseResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: { message: "Boolean search query is empty" } };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: { message: "Boolean search query exceeds 2000 characters" } };
  }

  const tokenized = tokenize(trimmed);
  if ("message" in tokenized) {
    return { ok: false, error: tokenized };
  }

  const parsed = new Parser(tokenized).parse();
  if ("message" in parsed) {
    return { ok: false, error: parsed };
  }

  return { ok: true, ast: parsed };
}

export function validateBooleanQuery(query: string): string | null {
  const result = parseBooleanQuery(query);
  return result.ok ? null : result.error.message;
}

/** Positive terms only — NOT clauses are retrieval exclusions, not discovery keywords. */
export function collectPositiveBooleanTerms(node: BooleanNode, negated = false): string[] {
  if (node.type === "term") return negated ? [] : [node.value];
  if (node.type === "not") return collectPositiveBooleanTerms(node.child, !negated);
  return [
    ...collectPositiveBooleanTerms(node.left, negated),
    ...collectPositiveBooleanTerms(node.right, negated),
  ];
}
