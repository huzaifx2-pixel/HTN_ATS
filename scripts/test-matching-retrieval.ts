/**
 * Matching v2 retrieval helpers (no database).
 * Usage: npx tsx scripts/test-matching-retrieval.ts
 */
import assert from "node:assert/strict";
import type { Job } from "@prisma/client";
import { collectPositiveBooleanTerms, parseBooleanQuery } from "@/lib/matching/boolean-search/parse";
import { discoveryTermsForJob } from "@/lib/matching/retrieval";
import { termsToOrTsquery } from "@/lib/search/boolean-tsquery";
import { compactRequirementBreakdown, isPersistableMatch, persistableMatchStatus } from "@/lib/matching/persist";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("positive boolean terms ignore NOT clauses", () => {
  const parsed = parseBooleanQuery('Python AND (React OR Vue) NOT junior');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const terms = collectPositiveBooleanTerms(parsed.ast);
  assert.ok(terms.includes("Python"));
  assert.ok(terms.includes("React") || terms.includes("Vue"));
  assert.ok(!terms.some((term) => /junior/i.test(term)));
});

test("OR tsquery is discovery-shaped, not AND", () => {
  const query = termsToOrTsquery(["Python", "React Native", "AWS"]);
  assert.ok(query);
  assert.match(query!, /\|/);
  assert.doesNotMatch(query!, / & /);
});

test("job discovery terms are Boolean terms only", () => {
  const job = {
    title: "Senior Data Architect",
    description: "Build pipelines",
    responsibilities: null,
    requirementsText: "Python, BigQuery",
    preferredQualifications: null,
    requirements: { skills: ["Python", "BigQuery"] },
    booleanSearch: "Python AND GCP",
    experienceMin: null,
  } as unknown as Job;
  const terms = discoveryTermsForJob(job);
  assert.ok(terms.some((term) => /python/i.test(term)));
  assert.ok(terms.some((term) => /gcp/i.test(term)));
  assert.ok(!terms.some((term) => /architect/i.test(term)));
  assert.ok(!terms.some((term) => /bigquery/i.test(term)));
});

test("persistable status drops not-qualified rows", () => {
  assert.equal(persistableMatchStatus("NOT_QUALIFIED"), null);
  assert.equal(persistableMatchStatus("STRONG"), "STRONG");
  assert.equal(persistableMatchStatus("POTENTIAL"), "POTENTIAL");
});

test("boolean miss is not kept on the match list", () => {
  assert.equal(
    isPersistableMatch(80, {
      booleanSearch: { query: "Java AND Spring", passes: false, matchedTerms: [] },
    }),
    false
  );
  assert.equal(
    isPersistableMatch(80, {
      booleanSearch: { query: "Python AND React", passes: true, matchedTerms: ["Python"] },
    }),
    true
  );
});

test("compact breakdown keeps matched and missing caps", () => {
  const compact = compactRequirementBreakdown({
    critical: { score: 35, maxScore: 35, confidence: "High", reasoning: "", matched: ["RN"], missing: [] },
    coreSkills: {
      score: 20,
      maxScore: 25,
      confidence: "Medium",
      reasoning: "",
      matched: ["Python"],
      missing: ["Kubernetes"],
    },
    preferredSkills: { score: 0, maxScore: 0, confidence: "Low", reasoning: "" },
    responsibilities: { score: 10, maxScore: 15, confidence: "Medium", reasoning: "" },
    experience: { score: 10, maxScore: 10, confidence: "High", reasoning: "" },
    jobTitle: { score: 7, maxScore: 7, confidence: "High", reasoning: "" },
    industry: { score: 0, maxScore: 0, confidence: "Low", reasoning: "" },
    location: { score: 50, maxScore: 50, confidence: "High", reasoning: "", matched: ["Austin"] },
    booleanSearch: { score: 50, maxScore: 50, confidence: "High", reasoning: "", matched: ["Python"] },
  });
  assert.ok(compact);
  assert.deepEqual(compact!.coreSkills.missing, ["Kubernetes"]);
  assert.equal(compact!.critical.score, 35);
  assert.deepEqual(compact!.location.matched, ["Austin"]);
  assert.deepEqual(compact!.booleanSearch.matched, ["Python"]);
});

console.log("\nMatching retrieval tests passed.");
