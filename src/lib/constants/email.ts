export const MERGE_FIELDS = [
  "{{FirstName}}",
  "{{LastName}}",
  "{{JobTitle}}",
  "{{Client}}",
  "{{Recruiter}}",
  "{{JobID}}",
  "{{Location}}",
  "{{Salary}}",
  "{{ApplyLink}}",
] as const;

export const MERGE_FIELD_HELP = [
  { field: "{{FirstName}}", description: "Candidate's first name" },
  { field: "{{LastName}}", description: "Candidate's last name" },
  { field: "{{JobTitle}}", description: "Job title from the requisition" },
  { field: "{{Client}}", description: "Client company name" },
  { field: "{{Recruiter}}", description: "Your name (email sender)" },
  { field: "{{JobID}}", description: "Job code (e.g. ACME-001)" },
  { field: "{{Location}}", description: "Job location and country from the requisition" },
  { field: "{{Salary}}", description: "Salary range with currency and period (/hr, /month, /annum)" },
  {
    field: "{{ApplyLink}}",
    description: "Clickable Apply here link — filled with the job apply URL when the email is sent",
  },
] as const;

export const HYPERLINK_MERGE_FIELDS = new Set(["{{ApplyLink}}", "{{ReferralLink}}"]);

/** Valid https placeholders so the editor does not strip merge-field hrefs. */
export const MERGE_LINK_PLACEHOLDERS: Record<"ApplyLink" | "ReferralLink", string> = {
  ApplyLink: "https://headsbase.app/__merge__/ApplyLink",
  ReferralLink: "https://headsbase.app/__merge__/ReferralLink",
};

import { formatJobLocation, formatJobSalary, getJobSalaryFields } from "@/lib/format-job";
import { getAppBaseUrl } from "@/lib/runtime/app-url";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function applyLinkHtml(hrefField: "{{ApplyLink}}" | "{{ReferralLink}}", label: string) {
  const key = hrefField === "{{ApplyLink}}" ? "ApplyLink" : "ReferralLink";
  const href = MERGE_LINK_PLACEHOLDERS[key];
  return `<a href="${href}" data-merge-field="${key}">${escapeHtml(label.trim() || key)}</a>`;
}

/** Turn recruiter-entered apply URLs into absolute http(s) links. */
export function normalizeApplyUrl(value: string, fallback = "") {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function mergeFieldFromHref(href: string): "ApplyLink" | "ReferralLink" | null {
  if (!href) return null;
  if (href.includes("__merge__/ApplyLink") || href.includes("{{ApplyLink}}")) return "ApplyLink";
  if (href.includes("__merge__/ReferralLink") || href.includes("{{ReferralLink}}")) return "ReferralLink";
  return null;
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function replaceMergeToken(template: string, key: string, value: string) {
  return template.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), () => value);
}

function applyHyperlinkMergeField(
  template: string,
  key: "ApplyLink" | "ReferralLink",
  url: string,
  asHtml: boolean,
) {
  const attrUrl = escapeAttr(url);
  const placeholder = MERGE_LINK_PLACEHOLDERS[key];
  let result = template.replaceAll(placeholder, url);

  result = result.replace(
    new RegExp(`<a\\b([^>]*data-merge-field="${key}"[^>]*)>`, "gi"),
    (_match, attrs: string) => {
      if (/href\s*=/i.test(attrs)) {
        return `<a${attrs.replace(/href\s*=\s*(["']).*?\1/i, `href="${attrUrl}"`)}>`;
      }
      return `<a href="${attrUrl}"${attrs}>`;
    },
  );

  result = result.replace(
    new RegExp(`href\\s*=\\s*(["'])\\{\\{\\s*${key}\\s*\\}\\}\\1`, "gi"),
    `href="${attrUrl}"`,
  );

  result = replaceMergeToken(
    result,
    key,
    asHtml ? `<a href="${attrUrl}">Apply here</a>` : url,
  );

  return result;
}

export function applyMergeFields(template: string, data: Record<string, string>): string {
  let result = template;
  const asHtml = /<[a-z][\s\S]*>/i.test(template);

  for (const key of ["ApplyLink", "ReferralLink"] as const) {
    const url = data[key];
    if (!url) continue;
    result = applyHyperlinkMergeField(result, key, url, asHtml);
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "ApplyLink" || key === "ReferralLink") continue;
    result = replaceMergeToken(result, key, value);
  }

  return result;
}

export const SAMPLE_EMAIL_MERGE_DATA: Record<string, string> = {
  FirstName: "Jane",
  LastName: "Doe",
  JobTitle: "Software Engineer",
  Client: "Acme",
  Recruiter: "Alex Recruiter",
  JobID: "ACME-001",
  Location: "Remote",
  Salary: "$120,000/annum",
  ApplyLink: "https://headsbase.app/apply/sample",
  ReferralLink: "https://headsbase.app/apply/sample",
  CustomLink: "https://headsbase.app/apply/sample",
};

export function buildEmailMergeData(input: {
  candidate: { firstName: string; lastName: string; email?: string | null };
  job: {
    id: string;
    jobCode: string;
    title: string;
    referralLink?: string | null;
    location?: string | null;
    country?: string | null;
    salaryMin?: unknown;
    salaryMax?: unknown;
    salaryCurrency?: string | null;
    metadata?: unknown;
  };
  clientName: string;
  recruiterName: string;
  customLink?: string;
  baseUrl?: string;
}) {
  const base = input.baseUrl ?? getAppBaseUrl();
  const defaultApplyLink = input.job.referralLink?.trim() || `${base}/apply/${input.job.id}`;
  const applyLink = normalizeApplyUrl(input.customLink ?? "", defaultApplyLink);

  return {
    FirstName: input.candidate.firstName || "Candidate",
    LastName: input.candidate.lastName || "",
    JobTitle: input.job.title,
    Client: input.clientName,
    Recruiter: input.recruiterName,
    JobID: input.job.jobCode,
    Location: formatJobLocation(input.job),
    Salary: formatJobSalary(getJobSalaryFields(input.job)),
    ApplyLink: applyLink,
    ReferralLink: applyLink,
    CustomLink: applyLink,
  };
}

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: "Job opportunity invite",
    subject: "{{JobTitle}} opportunity at {{Client}}",
    body: `<div>Hi {{FirstName}},</div>
<div><br></div>
<div>We reviewed your background and think you could be a strong fit for our {{JobTitle}} role at {{Client}}.</div>
<div><br></div>
<div>Location: {{Location}}</div>
<div>Salary: {{Salary}}</div>
<div><br></div>
<div><a href="https://headsbase.app/__merge__/ApplyLink" data-merge-field="ApplyLink">View the role and apply</a></div>
<div><br></div>
<div>{{Recruiter}}</div>`,
  },
  {
    name: "Custom link outreach",
    subject: "{{JobTitle}} opportunity — {{Location}}",
    body: `<div>Hi {{FirstName}},</div>
<div><br></div>
<div>I'm reaching out from {{Client}} about our {{JobTitle}} opening ({{JobID}}) in {{Location}}.</div>
<div><br></div>
<div>Salary: {{Salary}}</div>
<div><br></div>
<div>Please use this link for next steps: <a href="https://headsbase.app/__merge__/ApplyLink" data-merge-field="ApplyLink">Open opportunity</a></div>
<div><br></div>
<div>Happy to answer any questions.</div>
<div><br></div>
    <div>Best,</div>
<div>{{Recruiter}}</div>`,
  },
  {
    name: "Follow-up",
    subject: "Following up: {{JobTitle}} at {{Client}}",
    body: `<div>Hi {{FirstName}},</div>
<div><br></div>
<div>Just following up on the {{JobTitle}} role at {{Client}} I shared recently.</div>
<div><br></div>
<div>Location: {{Location}}</div>
<div>Salary: {{Salary}}</div>
<div><br></div>
<div>If you're interested, you can apply here: <a href="https://headsbase.app/__merge__/ApplyLink" data-merge-field="ApplyLink">View the role and apply</a></div>
<div><br></div>
<div>Happy to answer any questions.</div>
<div><br></div>
<div>Best,</div>
<div>{{Recruiter}}</div>`,
  },
] as const;
