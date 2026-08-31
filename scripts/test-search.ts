/**
 * Search filter unit tests.
 * Usage: npx tsx scripts/test-search.ts
 */
import assert from "node:assert/strict";
import { tokenizeSearchQuery } from "@/lib/services/search-utils";
import { booleanQueryToTsquery, plainQueryToTsquery } from "@/lib/search/boolean-tsquery";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("tokenizes multi-word queries", () => {
  assert.deepEqual(tokenizeSearchQuery("  Python   React  "), ["Python", "React"]);
});

test("returns empty for blank query", () => {
  assert.deepEqual(tokenizeSearchQuery("   "), []);
});

test("plain query becomes prefix tsquery", () => {
  assert.equal(plainQueryToTsquery("Java AWS"), "java:* & aws:*");
});

test("boolean AND/OR becomes tsquery", () => {
  const parsed = booleanQueryToTsquery('Java AND (AWS OR Azure) NOT intern');
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.match(parsed.tsquery, /java:\*/);
    assert.match(parsed.tsquery, /\|/);
    assert.match(parsed.tsquery, /!/);
  }
});

console.log("\nSearch utility tests passed.");
