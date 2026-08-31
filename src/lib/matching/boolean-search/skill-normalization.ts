/** Canonical aliases → recruiter-searchable normalized form. */
export const SKILL_ALIASES: Record<string, string> = {
  "amazon web services": "AWS",
  "aws": "AWS",
  "structured query language": "SQL",
  "sql": "SQL",
  "google workspace suite": "Google Workspace",
  "google workspace": "Google Workspace",
  "g suite": "Google Workspace",
  "microsoft office 365": "Microsoft 365",
  "office 365": "Microsoft 365",
  "microsoft 365": "Microsoft 365",
  "business intelligence": "BI",
  "bi": "BI",
  "machine learning": "Machine Learning",
  "ml": "Machine Learning",
  "kpi reporting": "KPI Reporting",
  "data analysis": "Data Analysis",
  "data analytics": "Data Analytics",
  "quality assurance": "QA",
  "qa": "QA",
};

export const SOFT_SKILLS = new Set(
  [
    "communication",
    "communication skills",
    "leadership",
    "collaboration",
    "problem solving",
    "teamwork",
    "team player",
    "writing",
    "presentation skills",
    "investigation",
    "organization",
    "motivation",
    "interpersonal",
    "time management",
    "adaptability",
    "critical thinking",
    "attention to detail",
    "detail oriented",
    "detail-oriented",
    "work ethic",
    "multitasking",
    "mentoring",
    "negotiation",
    "instruction following",
  ].map((s) => s.toLowerCase()),
);

/** Evaluation-task and generic phrases that must never enter a Boolean. */
export const REJECT_TERMS = new Set(
  [
    "reason",
    "reasons",
    "reasoning",
    "questions",
    "question",
    "relevance",
    "assignment",
    "assignments",
    "feedback",
    "manage assignments efficiently",
    "instruction following",
    "critical thinking",
    "problem solving",
    "team player",
    "detail oriented",
    "communication skills",
    "self starter",
    "fast paced",
    "fast-paced",
    "results driven",
    "results-oriented",
  ].map((s) => s.toLowerCase()),
);

export const GENERIC_VERBS = new Set(
  [
    "manage",
    "perform",
    "execute",
    "create",
    "review",
    "support",
    "coordinate",
    "maintain",
    "document",
    "develop",
    "implement",
    "assist",
    "ensure",
    "provide",
    "handle",
    "monitor",
    "analyze",
    "prepare",
    "build",
    "design",
    "deliver",
    "lead",
    "work",
    "help",
  ].map((s) => s.toLowerCase()),
);

export function normalizeEntity(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length < 2) return null;

  const aliasKey = trimmed.toLowerCase();
  if (SKILL_ALIASES[aliasKey]) return SKILL_ALIASES[aliasKey];

  // Preserve known acronyms / brands
  if (/^[A-Z0-9+#./-]{2,}$/.test(trimmed)) return trimmed;

  // Title-case short proper nouns (Snowflake, Slack)
  if (trimmed.length <= 30 && /^[A-Za-z0-9][A-Za-z0-9 .+#/-]*$/.test(trimmed)) {
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 6) return trimmed;
    return trimmed
      .split(/\s+/)
      .map((word) => {
        const lower = word.toLowerCase();
        if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];
        if (word.length <= 4 && word === word.toUpperCase()) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  return trimmed;
}

export function isSoftSkill(term: string): boolean {
  return SOFT_SKILLS.has(term.toLowerCase());
}

export function isRejectedTerm(term: string): boolean {
  return REJECT_TERMS.has(term.trim().toLowerCase());
}

export function isGenericVerb(term: string): boolean {
  const words = term.toLowerCase().split(/\s+/);
  return words.length === 1 && GENERIC_VERBS.has(words[0]);
}
