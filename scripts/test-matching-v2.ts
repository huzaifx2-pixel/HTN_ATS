/**
 * Matching: Boolean search + location only.
 * Skills, tools, and responsibilities are not scored.
 *
 * Usage: npx tsx scripts/test-matching-v2.ts
 */
import assert from "node:assert/strict";
import type { Candidate, Job } from "@prisma/client";
import { computeMatch } from "@/lib/matching/engine";
import { isPersistableMatch } from "@/lib/matching/persist";

const baseCandidate = {
  id: "c1",
  organizationId: "org1",
  firstName: "Jane",
  lastName: "Doe",
  summary: null,
  deletedAt: null,
  skills: ["Python", "React", "TypeScript"],
  experienceYears: 5,
  currentRole: "Senior Engineer",
  city: "Austin",
  location: "Austin, TX",
  country: "United States",
  workAuthorization: null,
} as unknown as Candidate;

const baseJob = {
  id: "j1",
  organizationId: "org1",
  title: "Full Stack Developer",
  description: "Build web apps with React and Python. Must have Kubernetes.",
  responsibilities: "Develop APIs and frontends. Own CI/CD tooling.",
  requirementsText: "Python, React, Kubernetes, Terraform",
  requirements: { skills: ["Python", "React", "Kubernetes"], tools: ["Terraform"], experienceYears: 3 },
  booleanSearch: "Python AND React",
  location: "Austin, TX",
  city: "Austin",
  country: "United States",
  remote: false,
  experienceMin: 3,
  preferredQualifications: null,
  metadata: null,
} as unknown as Job;

const resumeText =
  "Senior engineer in Austin, TX with 5 years Python and React experience. Built machine learning pipelines.";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("matching ignores skills, tools, and responsibilities for the score", () => {
  const result = computeMatch(baseJob, baseCandidate, undefined, { resumeText });
  assert.equal(result.analysis.sectionScores.requiredSkills.maxScore, 0);
  assert.equal(result.analysis.sectionScores.tools.maxScore, 0);
  assert.equal(result.analysis.sectionScores.responsibilities.maxScore, 0);
  assert.equal(result.analysis.sectionScores.experience.maxScore, 0);
  assert.ok(result.analysis.sectionScores.location.maxScore > 0);
  assert.ok((result.analysis.requirementBreakdown?.booleanSearch.maxScore ?? 0) > 0);
});

test("boolean miss scores 0 and is not persistable", () => {
  const job = { ...baseJob, booleanSearch: "Java AND Spring" } as unknown as Job;
  const result = computeMatch(job, baseCandidate, undefined, { resumeText });
  assert.equal(result.analysis.booleanSearch?.passes, false);
  assert.equal(result.score, 0);
  assert.equal(result.analysis.qualificationStatus, "NOT_QUALIFIED");
  assert.equal(isPersistableMatch(result.score, result.analysis), false);
});

test("missing tools or core skills do not disqualify a boolean+location match", () => {
  const result = computeMatch(baseJob, baseCandidate, undefined, { resumeText });
  assert.equal(result.analysis.booleanSearch?.passes, true);
  assert.ok(result.score >= 60, `expected persistable score, got ${result.score}`);
  assert.notEqual(result.analysis.qualificationStatus, "NOT_QUALIFIED");
  assert.equal(isPersistableMatch(result.score, result.analysis), true);
  assert.equal(result.analysis.criticalMissingRequirements.length, 0);
});

test("location mismatch is not persistable even when boolean passes", () => {
  const candidate = {
    ...baseCandidate,
    city: "Berlin",
    location: "Berlin, Germany",
    country: "Germany",
  } as unknown as Candidate;
  const result = computeMatch(baseJob, candidate, undefined, {
    resumeText: "Senior engineer in Berlin with Python and React.",
  });
  assert.equal(result.analysis.booleanSearch?.passes, true);
  assert.ok(result.analysis.sectionScores.location.score < result.analysis.sectionScores.location.maxScore * 0.6);
  assert.equal(isPersistableMatch(result.score, result.analysis), false);
});

test("location overlap contributes to the match score", () => {
  const result = computeMatch(baseJob, baseCandidate, undefined, { resumeText });
  assert.ok(result.analysis.sectionScores.location.score > 0);
  assert.match(result.analysis.sectionScores.location.reasoning, /location|austin|united states/i);
});

console.log("\nMatching boolean+location tests passed.");
