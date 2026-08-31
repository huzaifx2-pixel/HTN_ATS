/**
 * Unit tests for boolean search parser/evaluator.
 * Usage: npx tsx scripts/test-boolean-search.ts
 */
import assert from "node:assert/strict";
import { parseBooleanQuery, runBooleanSearch } from "@/lib/matching/boolean-search";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("parses AND/OR/NOT with parentheses", () => {
  const parsed = parseBooleanQuery('(Java OR Python) AND React NOT junior');
  assert.equal(parsed.ok, true);
});

test("parses quoted phrases", () => {
  const parsed = parseBooleanQuery('"machine learning" AND Python');
  assert.equal(parsed.ok, true);
});

test("rejects unclosed quote", () => {
  const parsed = parseBooleanQuery('"machine learning AND Python');
  assert.equal(parsed.ok, false);
});

test("evaluates OR match", () => {
  const result = runBooleanSearch("Java OR Python", "Experienced Python developer with Django");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.passes, true);
    assert.ok(result.matchedTerms.includes("Python"));
  }
});

test("evaluates NOT filter", () => {
  const result = runBooleanSearch('React NOT junior', "Senior React engineer with 8 years experience");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.passes, true);
  }

  const fail = runBooleanSearch('React NOT junior', "Junior React developer");
  assert.equal(fail.ok, true);
  if (fail.ok) assert.equal(fail.passes, false);
});

test("evaluates phrase match", () => {
  const result = runBooleanSearch('"machine learning"', "Built machine learning pipelines in production");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.passes, true);
});

test("does not substring-match Java to JavaScript", () => {
  const result = runBooleanSearch("Java", "Senior JavaScript engineer with React");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.passes, false);
});

test("quoted Java does not match JavaScript", () => {
  const result = runBooleanSearch('"Java"', "JavaScript developer");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.passes, false);
});

test("matches C# without matching plain C", () => {
  const csharp = runBooleanSearch("C#", "Built APIs in C# and .NET");
  assert.equal(csharp.ok, true);
  if (csharp.ok) assert.equal(csharp.passes, true);

  const plainC = runBooleanSearch("C", "Built APIs in C# and .NET");
  assert.equal(plainC.ok, true);
  if (plainC.ok) assert.equal(plainC.passes, false);
});

test("matches hyphen and space phrase variants", () => {
  const result = runBooleanSearch('"full stack"', "Full-stack engineer with React");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.passes, true);
});

test("matches node.js against nodejs", () => {
  const result = runBooleanSearch("Node.js", "Backend developer using NodeJS and Express");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.passes, true);
});

test("plus is AND and minus-term is NOT", () => {
  const parsed = parseBooleanQuery("Python + React -junior");
  assert.equal(parsed.ok, true);

  const pass = runBooleanSearch("Python + React -junior", "Senior Python and React engineer");
  assert.equal(pass.ok, true);
  if (pass.ok) {
    assert.equal(pass.passes, true);
    assert.equal(pass.matchedTerms.includes("junior"), false);
  }

  const fail = runBooleanSearch("Python + React -junior", "Junior Python and React intern");
  assert.equal(fail.ok, true);
  if (fail.ok) assert.equal(fail.passes, false);
});

test("NOT hits are omitted from matched terms", () => {
  const result = runBooleanSearch("Python NOT junior", "Junior Python intern");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.passes, false);
    assert.equal(result.matchedTerms.includes("junior"), false);
    assert.ok(result.matchedTerms.includes("Python"));
  }
});

console.log("\nAll boolean search tests passed.");
