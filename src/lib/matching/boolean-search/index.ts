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
import { evaluateBooleanSearch, withRelaxedJobTitleRequirement } from "./evaluate";

export function runBooleanSearch(query: string, corpus: string, jobTitle?: string) {
  const parsed = parseBooleanQuery(query);
  if (!parsed.ok) {
    return {
      ok: false as const,
      error: parsed.error.message,
    };
  }

  const trimmed = query.trim();
  const strict = evaluateBooleanSearch(parsed.ast, corpus, trimmed);
  if (strict.passes || !jobTitle?.trim()) {
    return {
      ok: true as const,
      ...strict,
    };
  }

  const relaxedAst = withRelaxedJobTitleRequirement(parsed.ast, jobTitle);
  const relaxed = evaluateBooleanSearch(relaxedAst, corpus, trimmed);
  return {
    ok: true as const,
    ...relaxed,
  };
}

export { withRelaxedJobTitleRequirement } from "./evaluate";
