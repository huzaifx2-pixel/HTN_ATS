export type { JobRequirements, BooleanSearchAnalysis } from "./types";

export {
  parseBooleanQuery,
  validateBooleanQuery,
  collectPositiveBooleanTerms,
  type BooleanNode,
  type BooleanParseResult,
} from "./parse";

export {
  evaluateBooleanAst,
  evaluateBooleanSearch,
  type BooleanEvaluationResult,
} from "./evaluate";

export { suggestBooleanSearch, suggestBooleanFromRequirements } from "./suggest";
export {
  generateBooleanSearch,
  resolveBooleanSearchForSave,
  type BooleanGeneratorInput,
} from "./generate";
export { matchJobFamily, JOB_FAMILY_TEMPLATES } from "./job-family-templates";
export { normalizeJobTitle } from "./title-normalize";

import { parseBooleanQuery } from "./parse";
import { evaluateBooleanSearch } from "./evaluate";

export function runBooleanSearch(query: string, corpus: string) {
  const parsed = parseBooleanQuery(query);
  if (!parsed.ok) {
    return {
      ok: false as const,
      error: parsed.error.message,
    };
  }

  const evaluation = evaluateBooleanSearch(parsed.ast, corpus, query.trim());
  return {
    ok: true as const,
    ...evaluation,
  };
}
