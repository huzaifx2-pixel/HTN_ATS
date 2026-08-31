const SKILL_SYNONYMS: Record<string, string> = {
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  reactjs: "React",
  react: "React",
  vuejs: "Vue.js",
  vue: "Vue.js",
  angularjs: "Angular",
  angular: "Angular",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  aws: "AWS",
  "amazon web services": "AWS",
  gcp: "Google Cloud",
  "google cloud": "Google Cloud",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  py: "Python",
  python: "Python",
  csharp: "C#",
  "c#": "C#",
  dotnet: ".NET",
  ".net": ".NET",
};

const TITLE_SYNONYMS: Record<string, string> = {
  "sr software engineer": "Senior Software Engineer",
  "senior software developer": "Senior Software Engineer",
  "senior software eng": "Senior Software Engineer",
  "sr swe": "Senior Software Engineer",
  "software dev": "Software Developer",
  "software engineer": "Software Engineer",
  "full stack developer": "Full Stack Developer",
  "fullstack developer": "Full Stack Developer",
  "devops engineer": "DevOps Engineer",
  "data scientist": "Data Scientist",
  "product manager": "Product Manager",
  "recruiter": "Recruiter",
  "talent acquisition": "Talent Acquisition Specialist",
};

const COMPANY_ALIASES: Record<string, string> = {
  ibm: "IBM",
  "i.b.m.": "IBM",
  "international business machines": "IBM",
  amazon: "Amazon",
  google: "Google",
  microsoft: "Microsoft",
  meta: "Meta",
  facebook: "Meta",
};

const COUNTRY_ISO: Record<string, string> = {
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  uae: "AE",
  "united arab emirates": "AE",
  uk: "GB",
  "united kingdom": "GB",
  india: "IN",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  france: "FR",
};

export function normalizeSkill(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (SKILL_SYNONYMS[key]) return SKILL_SYNONYMS[key];
  return raw
    .split(/[\s/]+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function normalizeJobTitle(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return TITLE_SYNONYMS[key] ?? raw.trim();
}

export function normalizeCompany(raw: string): string {
  const key = raw.trim().toLowerCase();
  return COMPANY_ALIASES[key] ?? raw.trim();
}

export function normalizeEmployerKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|limited|company)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCountry(raw: string): { code?: string; name: string } {
  const key = raw.trim().toLowerCase();
  const code = COUNTRY_ISO[key];
  if (code) return { code, name: raw.trim() };
  return { name: raw.trim() };
}

export function normalizePhoneE164(digits: string, countryCode?: string): string | undefined {
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length < 10) return undefined;
  if (cleaned.startsWith("1") && cleaned.length === 11) return `+${cleaned}`;
  if (countryCode) {
    const cc = countryCode.replace(/\D/g, "");
    if (cc && !cleaned.startsWith(cc)) return `+${cc}${cleaned}`;
  }
  if (cleaned.length === 10) return `+1${cleaned}`;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export function normalizeIsoDate(raw?: string): { iso?: string; inferred: boolean } {
  if (!raw?.trim()) return { inferred: true };
  if (/present|current|now/i.test(raw)) return { iso: undefined, inferred: false };
  const mmyyyy = raw.match(/([a-z]+)\.?\s*(\d{4})/i);
  if (mmyyyy) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const m = months[mmyyyy[1].slice(0, 3).toLowerCase()];
    if (m) return { iso: `${mmyyyy[2]}-${m}-01`, inferred: false };
  }
  const yyyy = raw.match(/\b(19|20)\d{2}\b/);
  if (yyyy) return { iso: `${yyyy[0]}-01-01`, inferred: true };
  return { inferred: true };
}
