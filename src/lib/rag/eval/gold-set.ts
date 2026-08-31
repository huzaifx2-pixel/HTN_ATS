import type { RagSourceType } from "@/lib/rag/types";

export type GoldQuestion = {
  id: string;
  query: string;
  expectedSourceTypes: RagSourceType[];
  success: string;
};

/** Structural gold set for retrieval eval. Expected IDs depend on tenant data. */
export const RAG_GOLD_QUESTIONS: GoldQuestion[] = [
  {
    id: "q01",
    query: "Which candidates have React and TypeScript experience?",
    expectedSourceTypes: ["resume"],
    success: "Top results include resume chunks mentioning those skills.",
  },
  {
    id: "q02",
    query: "Find data analyst jobs that require SQL.",
    expectedSourceTypes: ["job"],
    success: "Top results include job chunks with SQL / analyst language.",
  },
  {
    id: "q03",
    query: "Who is a strong match for a senior backend engineer role?",
    expectedSourceTypes: ["resume", "job"],
    success: "Mix of resume and job context, no invented names.",
  },
  {
    id: "q04",
    query: "Summarize open jobs in this organization.",
    expectedSourceTypes: ["job"],
    success: "Uses job titles and codes from retrieved jobs only.",
  },
  {
    id: "q05",
    query: "What did we email this candidate about the role?",
    expectedSourceTypes: ["email"],
    success: "Email subject/body citations when indexed.",
  },
  {
    id: "q06",
    query: "Any team chat notes about interview feedback?",
    expectedSourceTypes: ["chat", "activity"],
    success: "Chat or activity chunks; otherwise honest unknown.",
  },
  {
    id: "q07",
    query: "What is our outreach playbook for first-touch emails?",
    expectedSourceTypes: ["playbook", "marketing"],
    success: "Playbook or marketing template citations.",
  },
  {
    id: "q08",
    query: "Candidates currently in New York with Python.",
    expectedSourceTypes: ["resume"],
    success: "Resume chunks with location and Python.",
  },
  {
    id: "q09",
    query: "Jobs that mention healthcare or HIPAA.",
    expectedSourceTypes: ["job"],
    success: "Job descriptions containing those terms.",
  },
  {
    id: "q10",
    query: "Who has AWS certification on their resume?",
    expectedSourceTypes: ["resume"],
    success: "Resume certification/skills evidence.",
  },
  {
    id: "q11",
    query: "List marketing campaign names we have run.",
    expectedSourceTypes: ["marketing"],
    success: "Campaign/template names from index.",
  },
  {
    id: "q12",
    query: "What Boolean search is stored for the frontend engineer job?",
    expectedSourceTypes: ["job"],
    success: "Job chunk containing Boolean field.",
  },
  {
    id: "q13",
    query: "Candidates with 5+ years of experience in data analysis.",
    expectedSourceTypes: ["resume"],
    success: "Resume experience evidence, not guessed years.",
  },
  {
    id: "q14",
    query: "Remote jobs that allow worldwide applicants.",
    expectedSourceTypes: ["job"],
    success: "Job location/remote fields.",
  },
  {
    id: "q15",
    query: "Did we send a bulk email about a new opening this week?",
    expectedSourceTypes: ["email", "marketing"],
    success: "Email or campaign citations with dates if present.",
  },
  {
    id: "q16",
    query: "Internal policy for handling candidate PII.",
    expectedSourceTypes: ["playbook"],
    success: "Playbook hit or unknown if no playbook indexed.",
  },
  {
    id: "q17",
    query: "Find resumes that mention Snowflake or dbt.",
    expectedSourceTypes: ["resume"],
    success: "Resume skill/tool mentions.",
  },
  {
    id: "q18",
    query: "Which jobs require a bachelor's degree?",
    expectedSourceTypes: ["job"],
    success: "Job requirements/education text.",
  },
  {
    id: "q19",
    query: "Notes from recruiters about a candidate going to MCC.",
    expectedSourceTypes: ["activity", "chat"],
    success: "Activity/chat; no fabricated stage history.",
  },
  {
    id: "q20",
    query: "Machine learning engineer openings.",
    expectedSourceTypes: ["job"],
    success: "Job title/description match.",
  },
  {
    id: "q21",
    query: "Candidates whose current company is a bank or fintech.",
    expectedSourceTypes: ["resume"],
    success: "Resume company/industry evidence.",
  },
  {
    id: "q22",
    query: "How do we evaluate boolean search quality?",
    expectedSourceTypes: ["playbook"],
    success: "Playbook if present.",
  },
  {
    id: "q23",
    query: "Email templates for candidate rejection.",
    expectedSourceTypes: ["marketing", "playbook"],
    success: "Template subject/body citations.",
  },
  {
    id: "q24",
    query: "Jobs that list Kubernetes as a required skill.",
    expectedSourceTypes: ["job"],
    success: "Job requirements mentioning Kubernetes.",
  },
  {
    id: "q25",
    query: "Who on the team discussed salary expectations in chat?",
    expectedSourceTypes: ["chat"],
    success: "Chat chunks or unknown.",
  },
  {
    id: "q26",
    query: "Candidates available immediately or with short notice.",
    expectedSourceTypes: ["resume"],
    success: "Availability fields from resume/summary.",
  },
  {
    id: "q27",
    query: "Compare two similar open roles for a data analyst.",
    expectedSourceTypes: ["job"],
    success: "Multiple job citations, no invented differences.",
  },
  {
    id: "q28",
    query: "What should I tell a candidate about next interview steps?",
    expectedSourceTypes: ["playbook", "job"],
    success: "Playbook process or job-specific process text.",
  },
  {
    id: "q29",
    query: "Find candidates who look like a match for job code in our recent postings.",
    expectedSourceTypes: ["resume", "job"],
    success: "Both job and resume context retrieved.",
  },
  {
    id: "q30",
    query: "Any activity noting a candidate was not a fit?",
    expectedSourceTypes: ["activity"],
    success: "Activity notes only; no hallucinated rejection.",
  },
];

export const RAG_EVAL_METRICS = {
  retrievalHitRate: "Share of gold questions where at least one expected sourceType appears in top-k.",
  citationGrounding: "Share of answers that refuse when retrieval is empty.",
  matchRank: "For semantic match, compare blended rank vs boolean-only rank on the same job.",
  hallucinationRate: "Manual: recruiter flags invented people, scores, or job codes.",
  reviewer: "Admin or recruiter on Ask ATS citations.",
};
