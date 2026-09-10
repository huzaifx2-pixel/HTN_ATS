import assert from "node:assert/strict";
import {
  extractContactInfo,
  flattenContactFields,
} from "../src/lib/parsers/contact-extraction";
import { extractLocation } from "../src/lib/parsers/location-extraction";
import { parseOverrideKeys } from "../src/lib/parsers/candidate-fields";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

function contact(text: string, fileName?: string) {
  return flattenContactFields(extractContactInfo(text, { fileName }));
}

test("gold set: two-column NAME Email header", () => {
  const parsed = contact(
    "FAUZIA SHAIK Email: fauziashaik12@gmail.com\nMobile No: +1 469-407-3763\nSenior Data Engineer\nDallas, TX",
  );
  assert.equal(parsed.firstName, "Fauzia");
  assert.equal(parsed.lastName, "Shaik");
  assert.equal(parsed.email, "fauziashaik12@gmail.com");
  assert.match(parsed.phone ?? "", /4694073763|469-407-3763/);
});

test("gold set: Name: glued Emailid Phone", () => {
  const parsed = contact(
    "Name:Sri Ganesh Emailid:sriganeshgopu1@gmail.com Phone:5123871274\nAustin, TX",
  );
  assert.equal(parsed.firstName, "Sri");
  assert.equal(parsed.lastName, "Ganesh");
  assert.equal(parsed.email, "sriganeshgopu1@gmail.com");
  assert.ok((parsed.phone ?? "").includes("5123871274") || (parsed.phone ?? "").includes("512-387-1274"));
});

test("gold set: cover-page Candidate Name", () => {
  const parsed = contact(
    "Candidate Submittal Cover Page\nCandidate Name:\nAndrei Chtcherbina\nPhone Number:\n804-495-1064\nEmail:\nandrei.c@gmail.com",
  );
  assert.equal(parsed.firstName, "Andrei");
  assert.equal(parsed.lastName, "Chtcherbina");
  assert.equal(parsed.email, "andrei.c@gmail.com");
});

test("gold set: cover-page Full Legal Name", () => {
  const parsed = contact(
    "Candidate Submittal Form\nCandidate’s Full Legal Name\nRehana Sultana\nJob Title: Engineer\nrehana.s@gmail.com",
  );
  assert.equal(parsed.firstName, "Rehana");
  assert.equal(parsed.lastName, "Sultana");
});

test("gold set: personal email wins over corporate", () => {
  const parsed = contact(
    "Jane Doe\njane.doe@gmail.com\nSenior Engineer, Acme Corp\njane.doe@acme.com\nReferences: hr@oldemployer.com",
  );
  assert.equal(parsed.email, "jane.doe@gmail.com");
  assert.ok(parsed.emails == null);
  const info = extractContactInfo(
    "Jane Doe\njane.doe@gmail.com\nSenior Engineer, Acme Corp\njane.doe@acme.com\nReferences: hr@oldemployer.com",
  );
  assert.ok(info.emails.some((entry) => entry.value === "jane.doe@acme.com"));
});

test("gold set: labeled corporate header stays primary", () => {
  const parsed = contact("Name: Pat Smith\nEmail: pat.smith@acme.com\npat.smith@gmail.com");
  assert.equal(parsed.email, "pat.smith@acme.com");
});

test("gold set: concatenated email does not invent last name", () => {
  const parsed = contact("Fauzia\nfauziashaik12@gmail.com");
  assert.equal(parsed.firstName, "Fauzia");
  assert.equal(parsed.lastName, undefined);
});

test("gold set: dotted email can supply last name", () => {
  const parsed = contact("Gaurav\ngaurav.kumar@gmail.com", "gaurav_reactjs.pdf");
  assert.equal(parsed.firstName, "Gaurav");
  assert.equal(parsed.lastName, "Kumar");
});

test("gold set: filename fallback only when no header name", () => {
  const withHeader = contact("Jane Doe\njane@gmail.com", "Avinash_Yeluri_2026_resume.pdf");
  assert.equal(withHeader.firstName, "Jane");
  assert.equal(withHeader.lastName, "Doe");

  const fromFile = contact("Senior Engineer\navinash.yeluri@gmail.com", "Avinash_Yeluri_2026_resume.pdf");
  assert.equal(fromFile.firstName, "Avinash");
  assert.equal(fromFile.lastName, "Yeluri");
});

test("gold set: labeled header phone beats later digits", () => {
  const parsed = contact(
    "Name: Alex Rivera\nMobile: (415) 555-0199\nEmail: alex@gmail.com\nEmployee ID: 9988776655\nDuration: 2018-2024",
  );
  assert.match(parsed.phone ?? "", /4155550199|415-555-0199/);
});

test("location skips job-site Location under Organization", () => {
  const loc = extractLocation(`Jane Doe
Chicago, IL
jane@gmail.com

EXPERIENCE
Project # 3:
Organization : TCS
Role : Data Engineer
Duration : July 2022 to June 2023
Location : India
`);
  assert.equal(loc.city, "Chicago");
  assert.equal(loc.country, "United States");
  assert.ok(!/india/i.test(`${loc.location ?? ""} ${loc.fullAddress ?? ""}`));
});

test("location accepts City, Country", () => {
  const loc = extractLocation("Alekhya G\nHyderabad, India\nalekhyareddy1791@gmail.com");
  assert.equal(loc.city, "Hyderabad");
  assert.equal(loc.country, "India");
});

test("location does not match us inside using", () => {
  const loc = extractLocation("Jane Doe\nSkills: using AWS and business status dashboards");
  assert.ok(!loc.country);
  assert.ok(!loc.city);
});

test("parseOverrides includes contact fields", () => {
  const keys = parseOverrideKeys({ parseOverrides: { email: true, firstName: true, location: true } });
  assert.equal(keys.has("email"), true);
  assert.equal(keys.has("firstName"), true);
  assert.equal(keys.has("location"), true);
  assert.equal(keys.has("currentTitle"), false);
});
