/**
 * TF-IDF cosine similarity for resume ↔ job description matching.
 * Ported from binoydutt/Resume-Job-Description-Matching (Word2Vec+TF-IDF hybrid),
 * using TF-IDF document vectors without the 3GB Word2Vec model.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "shall", "can", "need", "this", "that", "these", "those", "i", "you", "he", "she", "it",
  "we", "they", "what", "which", "who", "whom", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "also", "our", "your", "their", "my",
  "his", "her", "its", "about", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "again", "further", "then", "once", "here", "there", "any",
  "work", "working", "experience", "years", "year", "role", "team", "company", "job", "position",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.+-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

type TfidfVector = Map<string, number>;

function buildTfidfVector(
  tokens: string[],
  documentFrequency: Map<string, number>,
  documentCount: number,
  boostTerms: Set<string>
): TfidfVector {
  const termFrequency = new Map<string, number>();
  for (const token of tokens) {
    const boost = boostTerms.has(token) ? 2 : 1;
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + boost);
  }

  const vector: TfidfVector = new Map();
  let l1Norm = 0;

  for (const [term, tf] of termFrequency) {
    const df = documentFrequency.get(term) ?? 0;
    const idf = Math.log((documentCount + 1) / (df + 1)) + 1;
    const weight = tf * idf;
    vector.set(term, weight);
    l1Norm += weight;
  }

  if (l1Norm > 0) {
    for (const [term, weight] of vector) {
      vector.set(term, weight / l1Norm);
    }
  }

  return vector;
}

function cosineSimilarity(a: TfidfVector, b: TfidfVector): number {
  if (a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [, va] of a) normA += va * va;
  for (const [, vb] of b) normB += vb * vb;

  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const [term, va] of smaller) {
    const vb = larger.get(term);
    if (vb) dot += va * vb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Top overlapping terms between job description and resume (for explainability). */
export function extractMatchingKeywords(
  jobText: string,
  resumeText: string,
  limit = 5
): string[] {
  const jobTokens = new Set(tokenize(jobText));
  const resumeTokens = tokenize(resumeText);
  const counts = new Map<string, number>();

  for (const token of resumeTokens) {
    if (jobTokens.has(token)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

/**
 * TF-IDF cosine similarity between job description text and resume text.
 * Required skills get 2× term weight (same idea as the repo's boosted "java" terms).
 */
export function tfIdfCosineSimilarity(
  jobText: string,
  resumeText: string,
  boostTerms: string[] = []
): number {
  const a = jobText.trim();
  const b = resumeText.trim();
  if (!a || !b) return 0;

  const documents = [a, b];
  const tokenized = documents.map(tokenize);
  const boost = new Set(boostTerms.map((t) => t.toLowerCase()));

  const documentFrequency = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const vectors = tokenized.map((tokens) =>
    buildTfidfVector(tokens, documentFrequency, documents.length, boost)
  );

  return cosineSimilarity(vectors[0], vectors[1]);
}
