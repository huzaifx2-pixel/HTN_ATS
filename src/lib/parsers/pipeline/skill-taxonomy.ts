export const SKILL_CATEGORIES: Record<string, string[]> = {
  "Programming Languages": [
    "python", "javascript", "typescript", "java", "c#", "c++", "go", "rust", "ruby", "php", "swift", "kotlin", "scala", "r",
  ],
  Frameworks: [
    "react", "next.js", "vue.js", "angular", "node.js", "django", "flask", "spring", "express", ".net", "laravel", "rails",
  ],
  Databases: [
    "postgresql", "mysql", "mongodb", "redis", "sqlite", "oracle", "dynamodb", "elasticsearch", "cassandra", "sql server",
  ],
  "Cloud Platforms": ["aws", "azure", "google cloud", "gcp", "heroku", "vercel", "cloudflare"],
  DevOps: ["docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions", "ci/cd", "helm"],
  "Data & AI": ["machine learning", "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "nlp", "computer vision"],
  "BI & Analytics": ["tableau", "power bi", "looker", "excel", "sql"],
  "Project Management": ["agile", "scrum", "jira", "confluence", "kanban"],
  "Soft Skills": ["leadership", "communication", "teamwork", "problem solving", "mentoring"],
  Tools: ["git", "linux", "postman", "figma", "slack"],
  ATS: ["greenhouse", "lever", "workday", "bullhorn", "jobvite"],
  Recruitment: ["sourcing", "full-cycle recruiting", "talent acquisition", "boolean search", "linkedin recruiter"],
  Healthcare: [
    "bls", "acls", "pals", "nrp", "tncc", "hipaa", "epic", "cerner", "meditech",
    "ehr", "emr", "icd-10", "cpt", "rn", "np", "lpn", "cna", "telemetry",
    "critical care", "med-surg", "icu", "er", "emergency", "oncology", "cardiology",
    "pediatrics", "labor and delivery", "or", "pacu",
  ],
};

export const SKILL_FAMILIES: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "node.js", "nodejs"],
  typescript: ["ts"],
  react: ["react.js", "reactjs"],
  "node.js": ["nodejs", "node"],
  kubernetes: ["k8s"],
  aws: ["amazon web services"],
  postgresql: ["postgres"],
  "c#": ["csharp", ".net"],
};

export function categorizeSkill(skillName: string): string {
  const normalized = skillName.toLowerCase().trim();
  for (const [category, keywords] of Object.entries(SKILL_CATEGORIES)) {
    if (keywords.some((k) => normalized === k || normalized.includes(k) || k.includes(normalized))) {
      return category;
    }
  }
  if (/recruit|talent|hiring|sourcing/i.test(skillName)) return "Recruitment";
  if (/aws|azure|cloud|gcp/i.test(skillName)) return "Cloud Platforms";
  if (/nurse|rn\b|np\b|hipaa|patient|clinical|ehr|emr/i.test(skillName)) return "Healthcare";
  return "Technical";
}

export function expandSkillFamily(skillName: string): string[] {
  const key = skillName.toLowerCase().trim();
  const extras = SKILL_FAMILIES[key] ?? [];
  const reverse = Object.entries(SKILL_FAMILIES)
    .filter(([, aliases]) => aliases.some((alias) => alias.toLowerCase() === key))
    .map(([canonical]) => canonical);
  return [...new Set([skillName, ...extras, ...reverse])];
}

export const DEFAULT_SKILL_CATEGORIES = Object.keys(SKILL_CATEGORIES);
