const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizePersonName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token && !SUFFIXES.has(token))
    .join(" ");
}

export function identityKeyFromName(normalizedName: string, externalId?: string | null): string {
  if (externalId?.trim()) return `ext:${externalId.trim().toLowerCase()}`;
  return `name:${normalizedName}`;
}

/** One referral event: same person + same Date Referred. */
export function identityKeyFromNameAndDate(normalizedName: string, dateReferred: Date): string {
  return `event:${normalizedName}|${dateReferred.toISOString()}`;
}

export function nameTokens(normalizedName: string): string[] {
  return normalizedName.split(" ").filter(Boolean);
}

export function firstLastKey(normalizedName: string): string | null {
  const tokens = nameTokens(normalizedName);
  if (tokens.length < 2) return tokens[0] ?? null;
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let inter = 0;
  for (const g of ta) if (tb.has(g)) inter += 1;
  return (2 * inter) / (ta.size + tb.size);
}

export type AtsNameCandidate = {
  id: string;
  firstName: string;
  lastName: string;
};

export type NameMatchHit = {
  candidateId: string;
  confidence: number;
  reason: string;
};

export type NameMatchResult =
  | { kind: "matched"; hit: NameMatchHit }
  | { kind: "needs_review"; hits: NameMatchHit[] }
  | { kind: "unmatched"; hits: NameMatchHit[] };

const AUTO_SIMILARITY = 0.7;
const REVIEW_SIMILARITY = 0.6;

export function matchCsvNameToCandidates(
  csvNormalizedName: string,
  candidates: AtsNameCandidate[],
  occupiedCandidateIds: Set<string> = new Set(),
): NameMatchResult {
  const pool = candidates.filter((c) => !occupiedCandidateIds.has(c.id));
  const indexed = pool.map((c) => {
    const normalized = normalizePersonName(`${c.firstName} ${c.lastName}`);
    return { ...c, normalized, firstLast: firstLastKey(normalized) };
  });

  const exact = indexed.filter((c) => c.normalized === csvNormalizedName);
  if (exact.length === 1) {
    return { kind: "matched", hit: { candidateId: exact[0].id, confidence: 1, reason: "Exact name" } };
  }
  if (exact.length > 1) {
    return {
      kind: "needs_review",
      hits: exact.map((c) => ({ candidateId: c.id, confidence: 1, reason: "Identical name" })),
    };
  }

  const csvFirstLast = firstLastKey(csvNormalizedName);
  if (csvFirstLast) {
    const firstLast = indexed.filter((c) => c.firstLast === csvFirstLast);
    if (firstLast.length === 1) {
      return {
        kind: "matched",
        hit: { candidateId: firstLast[0].id, confidence: 0.94, reason: "First + last (ignoring middle / suffix)" },
      };
    }
    if (firstLast.length > 1) {
      return {
        kind: "needs_review",
        hits: firstLast.map((c) => ({
          candidateId: c.id,
          confidence: 0.9,
          reason: "Shared first + last name",
        })),
      };
    }
  }

  const scored = indexed
    .map((c) => ({
      candidateId: c.id,
      confidence: nameSimilarity(csvNormalizedName, c.normalized),
      reason: "Name variation",
    }))
    .filter((h) => h.confidence >= REVIEW_SIMILARITY)
    .sort((a, b) => b.confidence - a.confidence);

  const auto = scored.filter((h) => h.confidence >= AUTO_SIMILARITY);
  if (auto.length === 1 && scored.filter((h) => h.confidence >= AUTO_SIMILARITY).length === 1) {
    return { kind: "matched", hit: auto[0] };
  }
  if (scored.length > 1) return { kind: "needs_review", hits: scored.slice(0, 5) };
  if (scored.length === 1 && scored[0].confidence >= AUTO_SIMILARITY) {
    return { kind: "matched", hit: scored[0] };
  }
  if (scored.length === 1) return { kind: "needs_review", hits: scored };
  return { kind: "unmatched", hits: [] };
}
