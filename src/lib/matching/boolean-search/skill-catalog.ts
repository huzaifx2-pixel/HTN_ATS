import type { JobFamilyId, JobFamilyTemplate } from "./job-family-templates";
import { JOB_FAMILY_TEMPLATES } from "./job-family-templates";
import type { EntityKind } from "./types";

export type CatalogEntry = {
  term: string;
  families: JobFamilyId[];
  kind: EntityKind;
};

const DATA: JobFamilyId[] = ["data-analytics", "data-engineering", "data-science", "ai-ml"];
const SWE: JobFamilyId[] = [
  "software-engineering",
  "software-backend",
  "software-frontend",
  "software-fullstack",
];
const SWE_CLOUD: JobFamilyId[] = [...SWE, "devops-cloud"];
const SCIENCE: JobFamilyId[] = [
  "chemistry",
  "biology",
  "physics",
  "mathematics",
  "life-sciences",
  "pharmaceutical",
  "academic-research",
];
const OFFICE: JobFamilyId[] = [
  ...DATA,
  ...SWE,
  "devops-cloud",
  "product-management",
  "project-management",
  "finance",
  "accounting",
  "sales",
  "marketing",
  "human-resources",
  "operations",
  "customer-success",
  "education",
];

function e(term: string, families: JobFamilyId[], kind: EntityKind = "hard_skill"): CatalogEntry {
  return { term, families, kind };
}

export const SKILL_CATALOG: CatalogEntry[] = [
  e("SQL", [...DATA, "software-engineering", "software-backend", "software-fullstack"], "technology"),
  e("Snowflake", DATA, "technology"),
  e("Databricks", DATA, "technology"),
  e("Tableau", ["data-analytics", "data-science"], "technology"),
  e("Power BI", ["data-analytics", "data-science", "finance"], "technology"),
  e("Looker", ["data-analytics"], "technology"),
  e("Excel", OFFICE, "tool"),
  e("KPI Reporting", ["data-analytics", "operations", "finance"], "hard_skill"),
  e("Data Validation", DATA, "hard_skill"),
  e("Data Analysis", DATA, "hard_skill"),
  e("Data Analytics", ["data-analytics"], "hard_skill"),
  e("Reporting", ["data-analytics", "finance", "operations"], "hard_skill"),
  e("Analytics", DATA, "hard_skill"),
  e("ETL", ["data-engineering", "data-analytics"], "hard_skill"),
  e("Data Modeling", [...DATA, "software-backend"], "hard_skill"),
  e("Data Warehousing", ["data-engineering", "data-analytics"], "hard_skill"),
  e("Airflow", ["data-engineering"], "technology"),
  e("Spark", ["data-engineering", "data-science"], "technology"),
  e("dbt", ["data-engineering", "data-analytics"], "technology"),
  e("Python", [...DATA, ...SWE_CLOUD, "academic-research"], "technology"),
  e("R", ["data-science", "data-analytics", "mathematics"], "technology"),
  e("Machine Learning", ["data-science", "ai-ml"], "hard_skill"),
  e("Deep Learning", ["ai-ml", "data-science"], "hard_skill"),
  e("Statistics", ["data-science", "data-analytics", "mathematics"], "hard_skill"),
  e("TensorFlow", ["ai-ml", "data-science"], "technology"),
  e("PyTorch", ["ai-ml", "data-science"], "technology"),
  e("NLP", ["ai-ml"], "hard_skill"),
  e("Java", SWE_CLOUD, "technology"),
  e("JavaScript", SWE, "technology"),
  e("TypeScript", SWE, "technology"),
  e("React", ["software-frontend", "software-fullstack", "software-engineering"], "technology"),
  e("Next.js", ["software-frontend", "software-fullstack"], "technology"),
  e("Node.js", ["software-backend", "software-fullstack", "software-engineering"], "technology"),
  e("FastAPI", ["software-backend", "software-fullstack", "ai-ml"], "technology"),
  e("Django", ["software-backend", "software-fullstack"], "technology"),
  e("Spring Boot", ["software-backend", "software-engineering"], "technology"),
  e("REST APIs", SWE_CLOUD, "hard_skill"),
  e("GraphQL", SWE, "technology"),
  e("C#", SWE, "technology"),
  e("Go", ["software-backend", "software-engineering", "devops-cloud"], "technology"),
  e("Rust", ["software-backend", "software-engineering"], "technology"),
  e("C++", ["software-engineering", "software-backend"], "technology"),
  e("HTML", ["software-frontend", "software-fullstack"], "technology"),
  e("CSS", ["software-frontend", "software-fullstack"], "technology"),
  e("PostgreSQL", SWE_CLOUD, "technology"),
  e("MySQL", SWE_CLOUD, "technology"),
  e("MongoDB", SWE, "technology"),
  e("Redis", SWE_CLOUD, "technology"),
  e("Kafka", ["software-backend", "data-engineering", "devops-cloud"], "technology"),
  e("AWS", SWE_CLOUD, "platform"),
  e("Amazon Web Services", SWE_CLOUD, "platform"),
  e("Microsoft Azure", SWE_CLOUD, "platform"),
  e("Google Cloud", SWE_CLOUD, "platform"),
  e("Docker", SWE_CLOUD, "technology"),
  e("Kubernetes", ["software-backend", "software-engineering", "devops-cloud"], "technology"),
  e("Terraform", ["devops-cloud", "software-backend"], "technology"),
  e("Jenkins", ["devops-cloud"], "technology"),
  e("GitHub Actions", ["devops-cloud", ...SWE], "technology"),
  e("CI/CD", ["devops-cloud", ...SWE], "hard_skill"),
  e("Linux", ["devops-cloud", "software-backend", "software-engineering"], "technology"),
  e("Git", SWE_CLOUD, "tool"),
  e("OAuth", SWE, "hard_skill"),
  e("SIEM", ["cybersecurity"], "technology"),
  e("Vulnerability Management", ["cybersecurity"], "hard_skill"),
  e("Network Security", ["cybersecurity"], "hard_skill"),
  e("Incident Response", ["cybersecurity"], "hard_skill"),
  e("Salesforce", ["sales", "customer-success", "marketing"], "platform"),
  e("HubSpot", ["marketing", "sales", "customer-success"], "platform"),
  e("ServiceNow", ["operations", "human-resources", "devops-cloud"], "platform"),
  e("Workday", ["human-resources", "finance"], "platform"),
  e("Jira", [...SWE, "product-management", "project-management"], "tool"),
  e("Confluence", [...SWE, "product-management", "project-management"], "tool"),
  e("Slack", OFFICE, "platform"),
  e("Google Workspace", OFFICE, "platform"),
  e("Microsoft 365", OFFICE, "platform"),
  e("QuickBooks", ["accounting", "finance"], "platform"),
  e("SAP", ["finance", "accounting", "operations"], "platform"),
  e("Oracle", ["finance", "accounting", "software-backend"], "platform"),
  e("Accounting", ["accounting", "finance"], "hard_skill"),
  e("GAAP", ["accounting"], "hard_skill"),
  e("Tax", ["accounting"], "hard_skill"),
  e("Tax Preparation", ["accounting"], "hard_skill"),
  e("Auditing", ["accounting", "data-analytics", "finance"], "hard_skill"),
  e("Financial Analysis", ["finance", "accounting"], "hard_skill"),
  e("Financial Modeling", ["finance"], "hard_skill"),
  e("Forecasting", ["finance", "operations"], "hard_skill"),
  e("Contract Review", ["legal"], "hard_skill"),
  e("Litigation", ["legal"], "hard_skill"),
  e("Corporate Law", ["legal"], "hard_skill"),
  e("Compliance", ["legal", "finance", "cybersecurity", "healthcare-clinical"], "hard_skill"),
  e("Contract Negotiation", ["legal"], "hard_skill"),
  e("Patient Care", ["healthcare-clinical"], "hard_skill"),
  e("Clinical Assessment", ["healthcare-clinical"], "hard_skill"),
  e("Electronic Health Records", ["healthcare-clinical"], "platform"),
  e("Clinical Trials", ["healthcare-research", "pharmaceutical"], "hard_skill"),
  e("GCP", ["healthcare-research", "pharmaceutical"], "hard_skill"),
  e("IRB", ["healthcare-research", "academic-research"], "hard_skill"),
  e("Pharmacology", ["pharmaceutical"], "hard_skill"),
  e("GMP", ["pharmaceutical", "manufacturing"], "hard_skill"),
  e("Drug Development", ["pharmaceutical"], "hard_skill"),
  e("Formulation", ["pharmaceutical", "chemistry"], "hard_skill"),
  e("FDA", ["pharmaceutical", "healthcare-research"], "hard_skill"),
  e("Organic Chemistry", ["chemistry", "pharmaceutical"], "hard_skill"),
  e("Analytical Chemistry", ["chemistry", "pharmaceutical"], "hard_skill"),
  e("Inorganic Chemistry", ["chemistry"], "hard_skill"),
  e("Physical Chemistry", ["chemistry"], "hard_skill"),
  e("Materials Chemistry", ["chemistry"], "hard_skill"),
  e("Spectroscopy", ["chemistry", "physics"], "hard_skill"),
  e("Chromatography", ["chemistry", "pharmaceutical"], "hard_skill"),
  e("Laboratory Research", SCIENCE, "hard_skill"),
  e("Chemical Analysis", ["chemistry"], "hard_skill"),
  e("Molecular Biology", ["biology", "life-sciences", "pharmaceutical"], "hard_skill"),
  e("Cell Biology", ["biology", "life-sciences"], "hard_skill"),
  e("Genetics", ["biology", "life-sciences"], "hard_skill"),
  e("PCR", ["biology", "life-sciences", "pharmaceutical"], "hard_skill"),
  e("Biotechnology", ["life-sciences", "pharmaceutical"], "hard_skill"),
  e("Assay Development", ["life-sciences", "pharmaceutical"], "hard_skill"),
  e("Cell Culture", ["biology", "life-sciences", "pharmaceutical"], "hard_skill"),
  e("Physics", ["physics"], "hard_skill"),
  e("Quantum Mechanics", ["physics"], "hard_skill"),
  e("Mathematical Modeling", ["mathematics", "physics", "data-science"], "hard_skill"),
  e("Mathematics", ["mathematics"], "hard_skill"),
  e("Probability", ["mathematics", "data-science"], "hard_skill"),
  e("Experimental Design", ["academic-research", ...SCIENCE], "hard_skill"),
  e("Scientific Writing", ["academic-research", ...SCIENCE], "hard_skill"),
  e("Curriculum Development", ["education"], "hard_skill"),
  e("Classroom Instruction", ["education"], "hard_skill"),
  e("Lesson Planning", ["education"], "hard_skill"),
  e("CAD", ["mechanical-engineering", "manufacturing", "civil-engineering"], "hard_skill"),
  e("SolidWorks", ["mechanical-engineering", "manufacturing"], "technology"),
  e("AutoCAD", ["civil-engineering", "mechanical-engineering", "manufacturing"], "technology"),
  e("Mechanical Design", ["mechanical-engineering"], "hard_skill"),
  e("FEA", ["mechanical-engineering"], "hard_skill"),
  e("Circuit Design", ["electrical-engineering"], "hard_skill"),
  e("PCB", ["electrical-engineering"], "hard_skill"),
  e("Embedded Systems", ["electrical-engineering"], "hard_skill"),
  e("MATLAB", ["electrical-engineering", "mechanical-engineering", "mathematics", "physics"], "technology"),
  e("Structural Analysis", ["civil-engineering"], "hard_skill"),
  e("Civil Design", ["civil-engineering"], "hard_skill"),
  e("Lean Manufacturing", ["manufacturing"], "hard_skill"),
  e("CNC", ["manufacturing"], "hard_skill"),
  e("Quality Control", ["manufacturing", "pharmaceutical"], "hard_skill"),
  e("Product Strategy", ["product-management"], "hard_skill"),
  e("Roadmapping", ["product-management"], "hard_skill"),
  e("User Research", ["product-management"], "hard_skill"),
  e("Agile", ["product-management", "project-management", ...SWE], "hard_skill"),
  e("Project Management", ["project-management"], "hard_skill"),
  e("Stakeholder Management", ["project-management", "product-management"], "hard_skill"),
  e("Risk Management", ["project-management", "finance"], "hard_skill"),
  e("Solution Selling", ["sales"], "hard_skill"),
  e("Pipeline Management", ["sales"], "hard_skill"),
  e("CRM", ["sales", "customer-success", "marketing"], "hard_skill"),
  e("SEO", ["marketing"], "hard_skill"),
  e("Content Marketing", ["marketing"], "hard_skill"),
  e("Google Analytics", ["marketing"], "technology"),
  e("Campaign Management", ["marketing"], "hard_skill"),
  e("Employee Relations", ["human-resources"], "hard_skill"),
  e("Talent Acquisition", ["human-resources"], "hard_skill"),
  e("HRIS", ["human-resources"], "platform"),
  e("Onboarding", ["human-resources", "customer-success"], "hard_skill"),
  e("Process Improvement", ["operations", "manufacturing"], "hard_skill"),
  e("Operations Management", ["operations"], "hard_skill"),
  e("Customer Success", ["customer-success"], "hard_skill"),
  e("Account Management", ["customer-success", "sales"], "hard_skill"),
  e("AWS Certified Solutions Architect", ["devops-cloud", "software-backend"], "certification"),
  e("AWS Certified Developer", ["devops-cloud", ...SWE], "certification"),
  e("AWS Certified", ["devops-cloud", ...SWE], "certification"),
  e("Azure Certified", ["devops-cloud"], "certification"),
  e("CISSP", ["cybersecurity"], "certification"),
  e("PMP", ["project-management"], "certification"),
  e("CPA", ["accounting"], "certification"),
  e("CFA", ["finance"], "certification"),
  e("CISA", ["cybersecurity", "accounting"], "certification"),
  e("CISM", ["cybersecurity"], "certification"),
  e("CompTIA Security+", ["cybersecurity"], "certification"),
  e("Google Data Analytics Certificate", ["data-analytics"], "certification"),
  e("Scrum Master", ["project-management"], "certification"),
  e("CSM", ["project-management"], "certification"),
  e("PSM", ["project-management"], "certification"),
];

const CATALOG_BY_TERM = new Map(SKILL_CATALOG.map((entry) => [entry.term.toLowerCase(), entry]));

export const CATALOG_DICTIONARY_TERMS = [...SKILL_CATALOG]
  .map((entry) => entry.term)
  .sort((a, b) => b.length - a.length);

export function lookupCatalogTerm(term: string): CatalogEntry | undefined {
  return CATALOG_BY_TERM.get(term.trim().toLowerCase());
}

export function isSkillAllowedForFamily(
  term: string,
  family: JobFamilyTemplate,
  options?: { required?: boolean; strict?: boolean },
): boolean {
  const normalized = term.trim();
  if (!normalized) return false;

  const entry = lookupCatalogTerm(normalized);
  if (entry) {
    if (entry.kind === "certification") {
      return entry.families.includes(family.id);
    }
    if (family.id === "generic") {
      return entry.families.length >= 3;
    }
    return entry.families.includes(family.id);
  }

  if (family.skillAllowPatterns?.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (family.coreSkills.some((skill) => skill.toLowerCase() === normalized.toLowerCase())) {
    return true;
  }

  if (isForeignFamilySkill(normalized, family)) {
    return false;
  }

  if (options?.required && !options.strict) {
    return family.id === "generic" || !isForeignFamilySkill(normalized, family);
  }

  return false;
}

function isForeignFamilySkill(term: string, family: JobFamilyTemplate): boolean {
  const lower = term.toLowerCase();
  for (const other of JOB_FAMILY_TEMPLATES) {
    if (other.id === family.id) continue;
    if (other.domain === family.domain) continue;
    if (other.coreSkills.some((skill) => skill.toLowerCase() === lower)) return true;
  }
  const entry = lookupCatalogTerm(term);
  if (entry && !entry.families.includes(family.id) && family.id !== "generic") {
    return true;
  }
  return false;
}
