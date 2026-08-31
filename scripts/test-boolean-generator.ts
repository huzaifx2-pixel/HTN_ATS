/**
 * Unit tests for automatic Boolean generator.
 * Usage: npx tsx scripts/test-boolean-generator.ts
 */
import assert from "node:assert/strict";
import { generateBooleanSearch } from "@/lib/matching/boolean-search/generate";
import { matchJobFamily } from "@/lib/matching/boolean-search/job-family-templates";
import { extractRecruiterEntities } from "@/lib/matching/boolean-search/entity-extractor";
import { stripStopPhrases } from "@/lib/matching/boolean-search/boolean-entities";
import { normalizeJobTitle } from "@/lib/matching/boolean-search/title-normalize";
import { parseBooleanQuery } from "@/lib/matching/boolean-search/parse";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("matches data analyst job family from title", () => {
  const family = matchJobFamily("Data Analyst", "SQL Snowflake reporting");
  assert.equal(family.id, "data-analytics");
});

test("data analyst titles stay in data family", () => {
  const family = matchJobFamily("Data Analyst", "");
  const result = generateBooleanSearch({ title: "Data Analyst", description: "SQL and Tableau" });
  assert.ok(result.includes("Data Analyst"));
  assert.match(result, /BI Analyst|Business Intelligence Analyst/i);
  assert.doesNotMatch(result, /Software Engineer/i);
  assert.doesNotMatch(result, /Frontend Engineer/i);
  assert.doesNotMatch(result, /Data Engineer/i);
  assert.doesNotMatch(result, /Data Scientist/i);
  assert.equal(family.id, "data-analytics");
});

test("strips stop phrases before extraction", () => {
  const cleaned = stripStopPhrases(
    "Working knowledge of common SaaS tools such as Slack, Google Workspace, or Microsoft 365",
  );
  assert.doesNotMatch(cleaned.toLowerCase(), /such as/);
});

test("extracts normalized SaaS tools without sentence fragments", () => {
  const entities = extractRecruiterEntities({
    description:
      "Working knowledge of common SaaS tools such as Slack, Google Workspace, or Microsoft 365 for sharing analytical outcomes.",
  });
  const terms = entities.map((e) => e.term.toLowerCase());
  assert.ok(terms.includes("slack"));
  assert.ok(terms.includes("google workspace"));
  assert.ok(terms.includes("microsoft 365"));
  assert.ok(!terms.some((t) => t.includes("such as")));
  assert.ok(!terms.some((t) => t.includes("for sharing")));
});

test("generates recruiter-grade data analyst boolean", () => {
  const result = generateBooleanSearch({
    title: "Data Analyst",
    description: `
      Requirements:
      Strong SQL skills and Snowflake experience required.
      KPI Reporting, Data Validation, and Auditing experience preferred.
      Working knowledge of Slack, Google Workspace, or Microsoft 365.
    `,
    requirements: {
      skills: ["SQL", "Snowflake", "KPI Reporting", "Data Validation", "Auditing"],
    },
  });

  assert.match(result, /Data Analyst/i);
  assert.match(result, /BI Analyst|Business Intelligence Analyst/i);
  assert.doesNotMatch(result, /Software Engineer/i);
  assert.doesNotMatch(result, /Frontend Engineer/i);
  assert.match(result, /SQL/i);
  assert.match(result, /Snowflake/i);
  assert.doesNotMatch(result, /such as/i);
  assert.doesNotMatch(result, /expertise in/i);
  assert.doesNotMatch(result, /for sharing/i);
  assert.doesNotMatch(result, /Litigation/i);
  assert.doesNotMatch(result, /Organic Chemistry/i);
  assert.equal(parseBooleanQuery(result).ok, true);
});

test("matches backend job family", () => {
  const family = matchJobFamily("Backend Engineer", "Python FastAPI AWS");
  assert.equal(family.id, "software-backend");
});

test("generates backend boolean with tech blocks", () => {
  const result = generateBooleanSearch({
    title: "Backend Engineer",
    description: "Python, FastAPI, Django, REST APIs. AWS, Docker, Kubernetes.",
    requirements: { skills: ["Python", "FastAPI"] },
  });

  assert.match(result, /Backend Engineer/i);
  assert.match(result, /Python/i);
  assert.match(result, /AWS|Docker|Kubernetes/i);
  assert.doesNotMatch(result, /Physician/i);
  assert.doesNotMatch(result, /Tableau/i);
});

test("returns empty string without title", () => {
  assert.equal(generateBooleanSearch({ title: "" }), "");
});

test("normalizes senior software engineer title", () => {
  const normalized = normalizeJobTitle("Sr Software Engineer");
  assert.equal(normalized.primary, "Senior Software Engineer");
  assert.ok(normalized.variants.includes("Software Engineer"));
});

test("normalizes chemistry professor/researcher title", () => {
  const normalized = normalizeJobTitle("Chemistry Professor/Researcher (PhD)");
  assert.equal(normalized.primary, "Chemistry Professor");
  assert.ok(normalized.variants.includes("Research Scientist"));
});

test("chemistry professor stays in chemistry family", () => {
  const family = matchJobFamily("Chemistry Professor", "Organic chemistry laboratory");
  assert.equal(family.id, "chemistry");

  const result = generateBooleanSearch({
    title: "Chemistry Professor/Researcher (PhD)",
    description: "Organic Chemistry, Analytical Chemistry, Spectroscopy, Chromatography, Laboratory Research.",
    requirements: {
      skills: ["Organic Chemistry", "Analytical Chemistry", "Spectroscopy"],
    },
  });

  assert.match(result, /Chemistry Professor/i);
  assert.match(result, /Research Scientist/i);
  assert.match(result, /Chemist/i);
  assert.match(result, /Organic Chemistry/i);
  assert.match(result, /Spectroscopy/i);
  assert.doesNotMatch(result, /Physician/i);
  assert.doesNotMatch(result, /Registered Nurse/i);
  assert.doesNotMatch(result, /Physiotherapist/i);
  assert.doesNotMatch(result, /Data Analyst/i);
  assert.doesNotMatch(result, /Tableau/i);
  assert.doesNotMatch(result, /Snowflake/i);
  assert.doesNotMatch(result, /\bSQL\b/i);
  assert.doesNotMatch(result, /Patient Care/i);
  assert.equal(parseBooleanQuery(result).ok, true);
});

test("rejects soft skills and evaluation terms", () => {
  const result = generateBooleanSearch({
    title: "Data Analyst",
    description: "SQL and Tableau",
    requirements: {
      skills: ["SQL", "Communication Skills", "Team Player", "Reason", "Questions", "Critical Thinking"],
    },
  });
  assert.match(result, /SQL/i);
  assert.doesNotMatch(result, /Communication Skills/i);
  assert.doesNotMatch(result, /Team Player/i);
  assert.doesNotMatch(result, /\bReason\b/i);
  assert.doesNotMatch(result, /Questions/i);
  assert.doesNotMatch(result, /Critical Thinking/i);
});

test("ranks required skills above preferred skills", () => {
  const result = generateBooleanSearch({
    title: "Data Analyst",
    description: "A reporting role.",
    requirements: {
      skills: ["SQL", "Snowflake"],
      preferredSkills: ["Looker"],
    },
  });
  const sqlAt = result.indexOf("SQL");
  const lookerAt = result.indexOf("Looker");
  assert.ok(sqlAt >= 0);
  if (lookerAt >= 0) {
    assert.ok(sqlAt < lookerAt, "required SQL should appear before preferred Looker");
  }
});

test("does not invent certifications", () => {
  const result = generateBooleanSearch({
    title: "Data Analyst",
    description: "SQL and Tableau reporting",
    requirements: { skills: ["SQL", "Tableau"] },
  });
  assert.doesNotMatch(result, /Google Data Analytics Certificate/i);
  assert.doesNotMatch(result, /CPA/i);
  assert.doesNotMatch(result, /CISSP/i);
});

test("includes certifications only when present and family-relevant", () => {
  const accounting = generateBooleanSearch({
    title: "Accountant",
    description: "CPA required. GAAP and tax preparation.",
    requirements: { skills: ["GAAP"], certifications: ["CPA"] },
  });
  assert.match(accounting, /CPA/);

  const chemistry = generateBooleanSearch({
    title: "Chemist",
    description: "Organic chemistry lab work. CPA mentioned in error.",
    requirements: { skills: ["Organic Chemistry"], certifications: ["CPA"] },
  });
  assert.doesNotMatch(chemistry, /CPA/);
});

test("does not treat an undelimited description as one skill", () => {
  const result = generateBooleanSearch({
    title: "Sr Software Engineer",
    description: "Python Java AWS Docker",
    requirements: { skills: ["Python", "Java"] },
  });
  assert.doesNotMatch(result, /Python Java AWS Docker/);
  assert.match(result, /Python/);
  assert.match(result, /Java/);
});

test("output uses titles AND skills blocks", () => {
  const result = generateBooleanSearch({
    title: "Chemistry Professor",
    description: "Organic Chemistry and Spectroscopy",
    requirements: { skills: ["Organic Chemistry", "Spectroscopy"] },
  });
  assert.match(result, /^\([\s\S]+\)\n\nAND\n\n\([\s\S]+\)$/);
  assert.doesNotMatch(result, /\bNOT\b/);
});

console.log("\nAll boolean generator tests passed.");
