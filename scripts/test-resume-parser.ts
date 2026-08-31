/**
 * Unit tests for resume parser v3 (sections, experience, skills, education, years union).
 * Usage: npx tsx scripts/test-resume-parser.ts
 */
import assert from "node:assert/strict";
import { extractSections, extractResumeSkills, unionExperienceYears } from "@/lib/parsers/extraction";
import { extractName } from "@/lib/parsers/contact-extraction";
import { resolvedParsedIdentity } from "@/lib/parsers/candidate-fields";
import { extractStructuredFromText } from "@/lib/parsers/pipeline/extract-structured";
import { runParsePipeline, structuredToLegacyResult } from "@/lib/parsers/pipeline/run-pipeline";
import { PARSER_PIPELINE_VERSION } from "@/lib/parsers/pipeline/types";
import { reconstructPdfReadingOrder } from "@/lib/parsers/pdf-layout";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

test("parser version is 3.0.0", () => {
  assert.equal(PARSER_PIPELINE_VERSION, "3.0.0");
});

test("section headings match whole-line aliases", () => {
  const text = `Jane Doe
jane@example.com

Professional Summary
Experienced engineer.

Work Experience
Senior Engineer
Acme Inc | Jan 2020 – Present
Built APIs.

Technical Skills
Python, React, AWS

Education
B.S. Computer Science, MIT, 2018
`;
  const sections = extractSections(text);
  assert.ok(sections.experience?.length);
  assert.ok(sections.skills?.length);
  assert.ok(sections.education?.length);
  assert.ok(sections.summary?.length);
});

test("two-line job header with Present dates", () => {
  const result = extractStructuredFromText({
    rawText: `Jane Doe
jane@x.com

Experience
Senior Software Engineer
Acme Inc | Jan 2020 – Present
Delivered search ranking.

Skills
TypeScript, React
`,
    resumeType: "TEXT",
    ocrUsed: false,
  });
  assert.ok(result.experience.length >= 1);
  const job = result.experience[0];
  assert.match(job.jobTitle.value, /engineer/i);
  assert.match(job.company.value, /acme/i);
  assert.equal(job.isCurrent, true);
  assert.ok((job.durationMonths ?? 0) > 12);
});

test("Title | Company | date range", () => {
  const result = extractStructuredFromText({
    rawText: `Pat Lee
pat@x.com

Experience
Software Engineer | Globex | Jan 2020 – Dec 2022
Wrote services.

Skills
Java
`,
    resumeType: "TEXT",
    ocrUsed: false,
  });
  assert.equal(result.experience[0]?.jobTitle.value.toLowerCase().includes("engineer"), true);
  assert.match(result.experience[0]?.company.value ?? "", /globex/i);
});

test("skills comma list does not pick CSV noise from body", () => {
  const listed = extractResumeSkills(
    "Click the flower button. Beets are a vegetable. Cement mixer.",
    ["Python, React, AWS, TypeScript"],
    "Built React apps in Python",
  );
  const lower = listed.map((s) => s.toLowerCase());
  assert.equal(lower.includes("click"), false);
  assert.equal(lower.includes("flower"), false);
  assert.ok(lower.some((s) => s.includes("python") || s === "react" || s === "aws"));
});

test("education parses degree, school, year", () => {
  const result = extractStructuredFromText({
    rawText: `Ada Lovelace
ada@x.com

Education
B.S. Computer Science, MIT, 2018

Experience
Engineer | Lab | 2019 – Present

Skills
Math
`,
    resumeType: "TEXT",
    ocrUsed: false,
  });
  assert.ok(result.education.length >= 1);
  assert.match(result.education[0].degree?.value ?? "", /bachelor/i);
  assert.equal(result.education[0].graduationDate, "2018");
});

test("overlapping jobs union years instead of summing", () => {
  const years = unionExperienceYears([
    { start: new Date(2020, 0, 1), end: new Date(2022, 0, 1) },
    { start: new Date(2021, 0, 1), end: new Date(2023, 0, 1) },
  ]);
  assert.ok(years >= 2.9 && years <= 3.2);
});

test("LinkedIn-style headings", () => {
  const sections = extractSections(`About
Product leader.

Experience
PM at Example

Licenses & certifications
PMP
`);
  assert.ok(sections.summary?.length);
  assert.ok(sections.experience?.length);
  assert.ok(sections.certifications?.length);
});

test("two-column PDF layout reads left then right", () => {
  const reconstructed = reconstructPdfReadingOrder([
    {
      num: 1,
      text: "Jane Doe\tAcme Inc\nEngineer\t2020 – Present\nToronto\tPython\nSkills\tTypeScript",
    },
  ]);
  assert.equal(reconstructed.extractionMethod, "layout");
  assert.match(reconstructed.text, /Jane Doe/);
  assert.match(reconstructed.text, /Acme Inc/);
});

test("pipeline returns structured v3 envelope fields", () => {
  const structured = runParsePipeline({
    rawText: `Alex Kim
alex@example.com
+1 555-0100
Toronto, Canada

SUMMARY
Backend engineer.

EXPERIENCE
Senior Software Engineer | Northwind | Jan 2019 – Present
Scaled APIs.

SKILLS
TypeScript, Node.js, PostgreSQL

EDUCATION
B.S. Computer Science, MIT, 2018
`,
    mimeType: "text/plain",
    fileName: "resume.txt",
  });
  const legacy = structuredToLegacyResult(structured);
  assert.equal(structured.parserVersion, "3.0.0");
  assert.ok(legacy.email);
  assert.ok(structured.metrics.totalYears > 0);
  assert.ok(Array.isArray(structured.awards));
  assert.ok(Array.isArray(structured.publications));
});

test("name extraction peels email/phone labels and cover-page names", () => {
  const cases: Array<{ text: string; fileName?: string; first: string; last?: string }> = [
    { text: "FAUZIA SHAIK Email: fauziashaik12@gmail.com\nSenior Data Engineer", first: "Fauzia", last: "Shaik" },
    { text: "Name:Sri Ganesh Emailid:sriganeshgopu1@gmail.com Phone:5123871274", first: "Sri", last: "Ganesh" },
    { text: "Gopi Chand Dev Ops Engineer908-382-4395\nGopisrinivas56@gmail.com", first: "Gopi", last: "Chand" },
    { text: "Sr. Lead Cloud Engineer|| SRE\nPrasad NContact: 571-336-6849\nEmail: prasad.devp@gmail.com", first: "Prasad", last: "N" },
    { text: "Name: Nikhil Sai\nPhone: (479)-326-0434", first: "Nikhil", last: "Sai" },
    { text: "PRANAY A EMAIL:pranaysync23@gmail.com (940)-222-6348", first: "Pranay", last: "A" },
    { text: "Candidate Submittal Cover Page\nCandidate Name:\nAndrei Chtcherbina\nPhone Number:\n804-495-1064", first: "Andrei", last: "Chtcherbina" },
    { text: "Candidate Submittal Form\nCandidate’s Full Legal Name\nRehana Sultana\nJob Title", first: "Rehana", last: "Sultana" },
    { text: "Lead Data Engineer with AI/ML\nName: Rajashekar K\nMail Id: shekar.r8763@gmail.com", first: "Rajashekar", last: "K" },
    { text: "Name: Tanmayi. KEmail: tanmayik461@gmail.com Phone: +1 253-289-0547", first: "Tanmayi", last: "K" },
    { text: "Sr. Data Engineer Name: Alekhya G\nEmail: alekhyareddy1791@gmail.com", first: "Alekhya", last: "G" },
    { text: "Jane Doe\njane@example.com", first: "Jane", last: "Doe" },
  ];

  for (const item of cases) {
    const name = extractName(item.text, item.fileName);
    assert.equal(name.firstName, item.first, `firstName for ${item.text.slice(0, 40)}`);
    assert.equal(name.lastName ?? "", item.last ?? "", `lastName for ${item.text.slice(0, 40)}`);
  }

  const fromFile = extractName("Big Data Engineer with 12+ years of experience building secure platforms", "Avinash_Yeluri_2026_resume.pdf");
  assert.equal(fromFile.firstName, "Avinash");
  assert.equal(fromFile.lastName, "Yeluri");

  const fromGaurav = extractName(
    "Bachelor of Engineering – Mechanical\nRTMNU\ngauravpokale1126@gmail.com Linked In\nLanguages: Java Script\nstate management",
    "gaurav_reactjs.pdf",
  );
  assert.equal(fromGaurav.firstName, "Gaurav");
  assert.equal(fromGaurav.lastName, "Pokale");

  const notTitle = extractName("Senior Data Engineer\nengineer@example.com");
  assert.notEqual(notTitle.firstName, "Senior");

  const notCover = extractName("Candidate Submittal Cover Page\nPhone Number:\n804-495-1064");
  assert.notEqual(notCover.firstName, "Candidate");
});

test("resolved identity prefers parser name then filename", () => {
  const fromParse = resolvedParsedIdentity({ firstName: "Fauzia", lastName: "Shaik" }, "ignore.pdf");
  assert.equal(fromParse.firstName, "Fauzia");
  assert.equal(fromParse.lastName, "Shaik");

  const fromFile = resolvedParsedIdentity({ firstName: "Unknown", lastName: "" }, "Avinash_Yeluri_2026_resume.pdf");
  assert.equal(fromFile.firstName, "Avinash");
  assert.equal(fromFile.lastName, "Yeluri");
});
