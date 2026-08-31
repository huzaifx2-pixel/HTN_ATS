/**
 * Verifies boolean search is a hard filter when set, and recruiter engine still runs when unset.
 */
import assert from "node:assert/strict";
import type { Candidate, Job } from "@prisma/client";
import { computeMatch } from "@/lib/matching/engine";

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
  city: null,
  location: null,
  country: null,
  workAuthorization: null,
} as unknown as Candidate;

const baseJob = {
  id: "j1",
  organizationId: "org1",
  title: "Full Stack Developer",
  description: "Build web apps with React and Python",
  responsibilities: "Develop APIs and frontends",
  requirementsText: "Python, React",
  requirements: { skills: ["Python", "React"], experienceYears: 3 },
  booleanSearch: null,
  location: "Remote",
  experienceMin: 3,
  preferredQualifications: null,
  metadata: null,
} as unknown as Job;

const resumeText =
  "Senior engineer with 5 years Python and React experience. Built machine learning pipelines.";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("without boolean: recruiter engine scores candidate", () => {
  const result = computeMatch(baseJob, baseCandidate, undefined, { resumeText });
  assert.ok(result.score > 0, "expected positive score without boolean filter");
  assert.equal(result.analysis.booleanSearch, undefined);
});

test("with boolean pass: candidate gets full recruiter score", () => {
  const job = { ...baseJob, booleanSearch: "Python AND React" };
  const result = computeMatch(job, baseCandidate, undefined, { resumeText });
  assert.ok(result.score >= 50, "expected passing recruiter score");
  assert.equal(result.analysis.booleanSearch?.passes, true);
  assert.ok(result.analysis.booleanSearch?.matchedTerms.includes("Python"));
});

test("with boolean fail: score is 0 and not persisted-worthy", () => {
  const job = { ...baseJob, booleanSearch: "Java NOT junior" };
  const result = computeMatch(job, baseCandidate, undefined, { resumeText });
  assert.equal(result.score, 0);
  assert.equal(result.analysis.booleanSearch?.passes, false);
  assert.match(result.reason, /boolean/i);
});

test("with boolean NOT filter: excludes junior in corpus", () => {
  const job = { ...baseJob, booleanSearch: "Python NOT junior" };
  const juniorResume = "Junior Python developer intern";
  const result = computeMatch(job, baseCandidate, undefined, { resumeText: juniorResume });
  assert.equal(result.score, 0);
});

console.log("\nBoolean integration tests passed.");
