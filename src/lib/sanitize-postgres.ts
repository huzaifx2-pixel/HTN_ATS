function stripUnsafeChars(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[\uD800-\uDFFF]/g, "");
}

/**
 * Double every backslash so JSON survives Prisma + PostgreSQL escaping.
 * Leaving `\n`/`\uXXXX` as "valid" escapes is wrong for resume *text*: those are
 * literal backslash characters, and the next parser layer treats `\u381` / `\x`
 * as hex escapes ("unexpected end of hex escape").
 */
function escapeBackslashesForJson(value: string): string {
  return stripUnsafeChars(value).replace(/\\/g, "\\\\");
}

/** PostgreSQL text fields cannot contain NUL (\\u0000) bytes. */
export function sanitizePostgresText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const cleaned = stripUnsafeChars(value).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function sanitizeForPostgresJson<T>(value: T): T {
  if (typeof value === "string") {
    return escapeBackslashesForJson(value) as T;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForPostgresJson(item)) as T;
  }
  if (value && typeof value === "object") {
    if (Object.prototype.toString.call(value) === "[object Date]") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeForPostgresJson(entry),
      ])
    ) as T;
  }
  return value;
}

export function toPrismaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(sanitizeForPostgresJson(value))) as T;
}
