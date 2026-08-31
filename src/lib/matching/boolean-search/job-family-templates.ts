/** Internal job-family templates — not exposed in the UI. */

export type JobFamilyId =
  | "software-engineering"
  | "software-backend"
  | "software-frontend"
  | "software-fullstack"
  | "data-engineering"
  | "data-science"
  | "data-analytics"
  | "ai-ml"
  | "devops-cloud"
  | "cybersecurity"
  | "product-management"
  | "project-management"
  | "finance"
  | "accounting"
  | "legal"
  | "healthcare-clinical"
  | "healthcare-research"
  | "pharmaceutical"
  | "life-sciences"
  | "chemistry"
  | "biology"
  | "physics"
  | "mathematics"
  | "academic-research"
  | "education"
  | "manufacturing"
  | "mechanical-engineering"
  | "electrical-engineering"
  | "civil-engineering"
  | "sales"
  | "marketing"
  | "human-resources"
  | "operations"
  | "customer-success"
  | "generic";

export type JobFamilyDomain =
  | "software"
  | "data"
  | "security"
  | "product"
  | "business"
  | "legal"
  | "healthcare"
  | "science"
  | "education"
  | "engineering"
  | "generic";

export type JobFamilyTemplate = {
  id: JobFamilyId;
  domain: JobFamilyDomain;
  /** Strong match against job title only. */
  titlePatterns: RegExp[];
  /** Secondary match against title + description. */
  keywords: RegExp[];
  relatedTitles: string[];
  /** Family-typical skills used only to fill a thin Boolean, never from another family. */
  coreSkills: string[];
  skillAllowPatterns?: RegExp[];
};

export const JOB_FAMILY_TEMPLATES: JobFamilyTemplate[] = [
  {
    id: "chemistry",
    domain: "science",
    titlePatterns: [
      /\bchemistry professor\b/i,
      /\bprofessor of chemistry\b/i,
      /\bchemistry researcher\b/i,
      /\bchemical researcher\b/i,
      /\bchemist\b/i,
      /\bchemistry\b/i,
    ],
    keywords: [
      /\borganic chemistry\b/i,
      /\banalytical chemistry\b/i,
      /\binorganic chemistry\b/i,
      /\bphysical chemistry\b/i,
      /\bspectroscopy\b/i,
      /\bchromatography\b/i,
      /\bchemical analysis\b/i,
    ],
    relatedTitles: [
      "Chemistry Professor",
      "Professor of Chemistry",
      "Chemistry Researcher",
      "Chemist",
      "Research Scientist",
      "Principal Scientist",
      "Postdoctoral Fellow",
      "Postdoctoral Researcher",
    ],
    coreSkills: [
      "Organic Chemistry",
      "Analytical Chemistry",
      "Spectroscopy",
      "Chromatography",
      "Laboratory Research",
      "Chemical Analysis",
      "Materials Chemistry",
    ],
    skillAllowPatterns: [/chemistr/i, /spectroscop/i, /chromatograph/i, /synthesis/i, /\blab(oratory)?\b/i],
  },
  {
    id: "biology",
    domain: "science",
    titlePatterns: [/\bbiologist\b/i, /\bbiology professor\b/i, /\bbiology\b/i, /\bmolecular biology\b/i],
    keywords: [/\bmolecular biology\b/i, /\bcell biology\b/i, /\bgenetics\b/i, /\bmicrobiology\b/i],
    relatedTitles: [
      "Biologist",
      "Biology Professor",
      "Molecular Biologist",
      "Research Scientist",
      "Postdoctoral Fellow",
    ],
    coreSkills: ["Molecular Biology", "Cell Biology", "Genetics", "PCR", "Laboratory Research"],
    skillAllowPatterns: [/biolog/i, /genetic/i, /\bpcr\b/i, /genom/i],
  },
  {
    id: "physics",
    domain: "science",
    titlePatterns: [/\bphysicist\b/i, /\bphysics professor\b/i, /\bphysics\b/i],
    keywords: [/\bquantum\b/i, /\bcondensed matter\b/i, /\bparticle physics\b/i],
    relatedTitles: ["Physicist", "Physics Professor", "Research Scientist", "Postdoctoral Fellow"],
    coreSkills: ["Physics", "Quantum Mechanics", "Mathematical Modeling", "Laboratory Research"],
    skillAllowPatterns: [/physics/i, /quantum/i, /optics/i],
  },
  {
    id: "mathematics",
    domain: "science",
    titlePatterns: [/\bmathematician\b/i, /\bmathematics professor\b/i, /\bmath professor\b/i, /\bactuary\b/i],
    keywords: [/\bmathematics\b/i, /\bstatistics professor\b/i, /\bactuar/i],
    relatedTitles: ["Mathematician", "Mathematics Professor", "Statistician", "Actuary"],
    coreSkills: ["Mathematics", "Statistics", "Probability", "Mathematical Modeling"],
    skillAllowPatterns: [/math/i, /statist/i, /probabilit/i, /actuar/i],
  },
  {
    id: "pharmaceutical",
    domain: "science",
    titlePatterns: [/\bpharmacist\b/i, /\bpharmaceutical\b/i, /\bpharmacologist\b/i, /\bformulary\b/i],
    keywords: [/\bpharmac/i, /\bgmp\b/i, /\bfda\b/i, /\bdrug development\b/i],
    relatedTitles: ["Pharmacist", "Pharmacologist", "Pharmaceutical Scientist", "Formulation Scientist"],
    coreSkills: ["Pharmacology", "GMP", "Drug Development", "Formulation", "FDA"],
    skillAllowPatterns: [/pharmac/i, /\bgmp\b/i, /formulation/i, /clinical trial/i],
  },
  {
    id: "life-sciences",
    domain: "science",
    titlePatterns: [/\blife science/i, /\bbiotech/i, /\bbioinformatics\b/i],
    keywords: [/\bbiotechnology\b/i, /\bassay\b/i, /\bcrispr\b/i],
    relatedTitles: ["Life Scientist", "Biotech Scientist", "Research Scientist", "Bioinformatics Scientist"],
    coreSkills: ["Biotechnology", "Assay Development", "Cell Culture", "Laboratory Research"],
    skillAllowPatterns: [/biotech/i, /assay/i, /cell culture/i, /crispr/i],
  },
  {
    id: "healthcare-clinical",
    domain: "healthcare",
    titlePatterns: [
      /\bphysician\b/i,
      /\bdoctor\b/i,
      /\bsurgeon\b/i,
      /\bnurse practitioner\b/i,
      /\bregistered nurse\b/i,
      /\bnurse\b/i,
      /\bphysiotherapist\b/i,
      /\bphysical therapist\b/i,
      /\bclinician\b/i,
      /\bparamedic\b/i,
    ],
    keywords: [/\bpatient care\b/i, /\bclinical assessment\b/i, /\bregistered nurse\b/i, /\bbedside\b/i],
    relatedTitles: ["Physician", "Registered Nurse", "Nurse Practitioner", "Physiotherapist", "Medical Specialist"],
    coreSkills: ["Patient Care", "Clinical Assessment", "Electronic Health Records"],
    skillAllowPatterns: [/patient/i, /clinical/i, /\behr\b/i, /\bhipaa\b/i, /nurs/i],
  },
  {
    id: "healthcare-research",
    domain: "healthcare",
    titlePatterns: [
      /\bclinical research\b/i,
      /\bclinical trial\b/i,
      /\bmedical researcher\b/i,
      /\bepidemiolog/i,
    ],
    keywords: [/\bclinical trial\b/i, /\bprotocol\b/i, /\birb\b/i, /\bcrc\b/i],
    relatedTitles: [
      "Clinical Research Associate",
      "Clinical Research Coordinator",
      "Medical Researcher",
      "Epidemiologist",
    ],
    coreSkills: ["Clinical Trials", "GCP", "Protocol Development", "IRB"],
    skillAllowPatterns: [/clinical trial/i, /\bgcp\b/i, /\birb\b/i, /epidemiolog/i],
  },
  {
    id: "academic-research",
    domain: "science",
    titlePatterns: [/\bresearch scientist\b/i, /\bpostdoctoral\b/i, /\bpostdoc\b/i, /\bprofessor\b/i, /\bfaculty\b/i],
    keywords: [/\bpeer[- ]reviewed\b/i, /\bgrant\b/i, /\bprincipal investigator\b/i],
    relatedTitles: [
      "Research Scientist",
      "Postdoctoral Fellow",
      "Postdoctoral Researcher",
      "Principal Investigator",
      "Professor",
    ],
    coreSkills: ["Laboratory Research", "Scientific Writing", "Experimental Design"],
    skillAllowPatterns: [/research/i, /experiment/i, /laboratory/i],
  },
  {
    id: "education",
    domain: "education",
    titlePatterns: [/\bteacher\b/i, /\binstructor\b/i, /\blecturer\b/i, /\bschool principal\b/i, /\bcurriculum\b/i],
    keywords: [/\bclassroom\b/i, /\bcurriculum\b/i, /\bk-12\b/i, /\bstudents\b/i],
    relatedTitles: ["Teacher", "Instructor", "Lecturer", "Curriculum Specialist"],
    coreSkills: ["Curriculum Development", "Classroom Instruction", "Lesson Planning"],
    skillAllowPatterns: [/curriculum/i, /classroom/i, /instruction/i, /pedagog/i],
  },
  {
    id: "accounting",
    domain: "business",
    titlePatterns: [/\bcpa\b/i, /\baccountant\b/i, /\btax (specialist|accountant|preparer)\b/i, /\bbookkeeper\b/i, /\bauditor\b/i],
    keywords: [/\bgap\b/i, /\bgaap\b/i, /\breconcile/i, /\baccounts payable\b/i, /\bgeneral ledger\b/i],
    relatedTitles: ["CPA", "Accountant", "Tax Specialist", "Senior Accountant", "Auditor", "Bookkeeper"],
    coreSkills: ["Accounting", "GAAP", "Tax", "Auditing", "Excel"],
    skillAllowPatterns: [/account/i, /\bgaap\b/i, /\btax\b/i, /audit/i, /ledger/i],
  },
  {
    id: "finance",
    domain: "business",
    titlePatterns: [
      /\bfinancial analyst\b/i,
      /\binvestment (banker|analyst)\b/i,
      /\bportfolio manager\b/i,
      /\bcontroller\b/i,
      /\bfinance manager\b/i,
    ],
    keywords: [/\bfinancial modeling\b/i, /\bvaluation\b/i, /\bforecast/i, /\bcfp\b/i],
    relatedTitles: ["Financial Analyst", "Finance Manager", "Investment Analyst", "Controller"],
    coreSkills: ["Financial Analysis", "Financial Modeling", "Excel", "Forecasting"],
    skillAllowPatterns: [/financ/i, /valuation/i, /forecast/i, /modeling/i],
  },
  {
    id: "legal",
    domain: "legal",
    titlePatterns: [/attorney/i, /lawyer/i, /corporate counsel/i, /legal counsel/i, /paralegal/i, /\bcounsel\b/i],
    keywords: [/litigation/i, /contract review/i, /corporate law/i, /compliance/i],
    relatedTitles: ["Corporate Counsel", "Attorney", "Lawyer", "Legal Counsel", "Paralegal"],
    coreSkills: ["Contract Review", "Litigation", "Corporate Law", "Compliance"],
    skillAllowPatterns: [/law/i, /legal/i, /litigation/i, /contract/i, /compliance/i],
  },
  {
    id: "mechanical-engineering",
    domain: "engineering",
    titlePatterns: [/\bmechanical engineer\b/i, /\bmechatronics\b/i],
    keywords: [/\bsolidworks\b/i, /\bfea\b/i, /\bthermodynamics\b/i],
    relatedTitles: ["Mechanical Engineer", "Design Engineer", "Mechatronics Engineer"],
    coreSkills: ["CAD", "SolidWorks", "Mechanical Design", "FEA"],
    skillAllowPatterns: [/mechanical/i, /solidworks/i, /\bcad\b/i, /\bfea\b/i],
  },
  {
    id: "electrical-engineering",
    domain: "engineering",
    titlePatterns: [/\belectrical engineer\b/i, /\belectronics engineer\b/i, /\bfirmware engineer\b/i],
    keywords: [/\bcircuit\b/i, /\bpcb\b/i, /\bembedded\b/i, /\bverilog\b/i],
    relatedTitles: ["Electrical Engineer", "Electronics Engineer", "Firmware Engineer"],
    coreSkills: ["Circuit Design", "PCB", "Embedded Systems", "MATLAB"],
    skillAllowPatterns: [/electrical/i, /circuit/i, /\bpcb\b/i, /embedded/i, /firmware/i],
  },
  {
    id: "civil-engineering",
    domain: "engineering",
    titlePatterns: [/\bcivil engineer\b/i, /\bstructural engineer\b/i, /\bgeotechnical\b/i],
    keywords: [/\bautocad\b/i, /\bstormwater\b/i, /\bstructural analysis\b/i],
    relatedTitles: ["Civil Engineer", "Structural Engineer", "Project Engineer"],
    coreSkills: ["AutoCAD", "Structural Analysis", "Civil Design"],
    skillAllowPatterns: [/civil/i, /structural/i, /autocad/i, /survey/i],
  },
  {
    id: "manufacturing",
    domain: "engineering",
    titlePatterns: [
      /manufacturing engineer/i,
      /cnc programmer/i,
      /production engineer/i,
      /process engineer/i,
      /industrial engineer/i,
    ],
    keywords: [/lean manufacturing/i, /six sigma/i, /\bcnc\b/i, /quality control/i],
    relatedTitles: [
      "Manufacturing Engineer",
      "CNC Programmer",
      "Process Engineer",
      "Production Engineer",
      "Industrial Engineer",
    ],
    coreSkills: ["Lean Manufacturing", "CNC", "Quality Control", "CAD"],
    skillAllowPatterns: [/manufactur/i, /\bcnc\b/i, /lean/i, /six sigma/i],
  },
  {
    id: "ai-ml",
    domain: "data",
    titlePatterns: [
      /\bmachine learning engineer\b/i,
      /\bml engineer\b/i,
      /\bai engineer\b/i,
      /\bai researcher\b/i,
      /\bdeep learning\b/i,
      /\bllm\b/i,
    ],
    keywords: [/machine learning/i, /deep learning/i, /\bnlp\b/i, /\bllm\b/i, /pytorch/i],
    relatedTitles: [
      "Machine Learning Engineer",
      "ML Engineer",
      "AI Engineer",
      "Deep Learning Engineer",
      "Applied Scientist",
    ],
    coreSkills: ["Machine Learning", "Python", "PyTorch", "TensorFlow", "Deep Learning"],
    skillAllowPatterns: [/machine learning/i, /deep learning/i, /pytorch/i, /tensorflow/i, /\bnlp\b/i, /\bllm\b/i],
  },
  {
    id: "data-engineering",
    domain: "data",
    titlePatterns: [/\bdata engineer\b/i, /\betl developer\b/i, /\banalytics engineer\b/i],
    keywords: [/data pipeline/i, /data warehouse/i, /\betl\b/i, /airflow/i, /spark/i],
    relatedTitles: ["Data Engineer", "Analytics Engineer", "ETL Developer", "Big Data Engineer"],
    coreSkills: ["Python", "SQL", "ETL", "Airflow", "Spark"],
    skillAllowPatterns: [/\betl\b/i, /pipeline/i, /airflow/i, /spark/i, /warehouse/i, /\bsql\b/i],
  },
  {
    id: "data-science",
    domain: "data",
    titlePatterns: [/\bdata scientist\b/i, /\bapplied scientist\b/i],
    keywords: [/data scientist/i, /statistical modeling/i, /experimentation/i],
    relatedTitles: ["Data Scientist", "Applied Scientist", "Research Scientist"],
    coreSkills: ["Python", "Machine Learning", "Statistics", "SQL"],
    skillAllowPatterns: [/python/i, /statist/i, /machine learning/i, /\bsql\b/i],
  },
  {
    id: "data-analytics",
    domain: "data",
    titlePatterns: [
      /\bdata analyst\b/i,
      /\bbi analyst\b/i,
      /\bbusiness intelligence analyst\b/i,
      /\banalytics analyst\b/i,
      /\breporting analyst\b/i,
      /\banalytics consultant\b/i,
    ],
    keywords: [/\bdata analyst\b/i, /\bbi analyst\b/i, /\bkpi reporting\b/i, /\bpower bi\b/i, /\btableau\b/i],
    relatedTitles: [
      "Data Analyst",
      "BI Analyst",
      "Business Intelligence Analyst",
      "Reporting Analyst",
      "Analytics Consultant",
    ],
    coreSkills: ["SQL", "Tableau", "Power BI", "Snowflake", "KPI Reporting"],
    skillAllowPatterns: [
      /\bsql\b/i,
      /tableau/i,
      /power bi/i,
      /snowflake/i,
      /looker/i,
      /excel/i,
      /kpi/i,
      /reporting/i,
      /analytics/i,
    ],
  },
  {
    id: "cybersecurity",
    domain: "security",
    titlePatterns: [
      /\bsecurity engineer\b/i,
      /\bcybersecurity\b/i,
      /\bsoc analyst\b/i,
      /\bpenetration tester\b/i,
      /\binformation security\b/i,
    ],
    keywords: [/\bsiem\b/i, /\bsoc\b/i, /vulnerability/i, /\bcissp\b/i],
    relatedTitles: [
      "Security Engineer",
      "Cybersecurity Analyst",
      "SOC Analyst",
      "Penetration Tester",
      "Information Security Analyst",
    ],
    coreSkills: ["SIEM", "Vulnerability Management", "Network Security", "Incident Response"],
    skillAllowPatterns: [/security/i, /\bsiem\b/i, /\bsoc\b/i, /vulnerability/i, /\bcissp\b/i],
  },
  {
    id: "devops-cloud",
    domain: "software",
    titlePatterns: [
      /\bdevops\b/i,
      /\bsite reliability\b/i,
      /\bcloud engineer\b/i,
      /\bplatform engineer\b/i,
      /\binfrastructure engineer\b/i,
    ],
    keywords: [/kubernetes/i, /terraform/i, /ci\/cd/i, /aws/i, /docker/i],
    relatedTitles: [
      "DevOps Engineer",
      "Site Reliability Engineer",
      "Cloud Engineer",
      "Platform Engineer",
      "Infrastructure Engineer",
    ],
    coreSkills: ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD"],
    skillAllowPatterns: [/aws/i, /azure/i, /gcp/i, /kubernetes/i, /docker/i, /terraform/i, /linux/i],
  },
  {
    id: "software-backend",
    domain: "software",
    titlePatterns: [
      /\bbackend engineer\b/i,
      /\bbackend developer\b/i,
      /\bserver[- ]side\b/i,
      /\bapi developer\b/i,
    ],
    keywords: [/backend/i, /server[- ]side/i, /api developer/i, /microservices/i],
    relatedTitles: [
      "Backend Engineer",
      "Backend Developer",
      "Software Engineer",
      "Backend Software Engineer",
      "API Developer",
    ],
    coreSkills: ["Python", "Java", "REST APIs", "PostgreSQL", "Docker"],
    skillAllowPatterns: [
      /python/i,
      /java/i,
      /golang|\bgo\b/i,
      /fastapi/i,
      /django/i,
      /spring/i,
      /postgres/i,
      /api/i,
      /docker/i,
      /aws/i,
      /kubernetes/i,
    ],
  },
  {
    id: "software-frontend",
    domain: "software",
    titlePatterns: [
      /\bfrontend engineer\b/i,
      /\bfrontend developer\b/i,
      /\bfront[- ]end\b/i,
      /\bui engineer\b/i,
    ],
    keywords: [/frontend/i, /front[- ]end/i, /react/i, /ui engineer/i],
    relatedTitles: ["Frontend Engineer", "Frontend Developer", "UI Engineer", "Software Engineer"],
    coreSkills: ["JavaScript", "TypeScript", "React", "CSS", "HTML"],
    skillAllowPatterns: [/javascript/i, /typescript/i, /react/i, /css/i, /html/i, /next\.?js/i],
  },
  {
    id: "software-fullstack",
    domain: "software",
    titlePatterns: [/\bfull[- ]stack\b/i, /\bfullstack\b/i],
    keywords: [/full[- ]stack/i, /fullstack/i],
    relatedTitles: ["Full Stack Engineer", "Full Stack Developer", "Software Engineer", "Web Developer"],
    coreSkills: ["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL"],
    skillAllowPatterns: [/javascript/i, /typescript/i, /react/i, /node/i, /python/i, /postgres/i, /aws/i],
  },
  {
    id: "software-engineering",
    domain: "software",
    titlePatterns: [/\bsoftware engineer\b/i, /\bsoftware developer\b/i, /\bapplication developer\b/i],
    keywords: [/software engineer/i, /software developer/i, /\bswe\b/i],
    relatedTitles: ["Software Engineer", "Software Developer", "Application Developer"],
    coreSkills: ["Python", "Java", "JavaScript", "Git"],
    skillAllowPatterns: [
      /python/i,
      /java/i,
      /javascript/i,
      /typescript/i,
      /git/i,
      /aws/i,
      /docker/i,
      /sql/i,
    ],
  },
  {
    id: "product-management",
    domain: "product",
    titlePatterns: [/\bproduct manager\b/i, /\bproduct owner\b/i, /\bproduct lead\b/i],
    keywords: [/\broadmap\b/i, /\buser stories\b/i, /\bproduct strategy\b/i],
    relatedTitles: ["Product Manager", "Product Owner", "Senior Product Manager", "Technical Product Manager"],
    coreSkills: ["Product Strategy", "Roadmapping", "User Research", "Agile"],
    skillAllowPatterns: [/product/i, /roadmap/i, /agile/i, /jira/i],
  },
  {
    id: "project-management",
    domain: "product",
    titlePatterns: [/\bproject manager\b/i, /\bprogram manager\b/i, /\bscrum master\b/i, /\bpmo\b/i],
    keywords: [/\bpmp\b/i, /\bwaterfall\b/i, /\bstakeholder\b/i, /\braid\b/i],
    relatedTitles: ["Project Manager", "Program Manager", "Scrum Master", "Technical Project Manager"],
    coreSkills: ["Project Management", "Agile", "Stakeholder Management", "Risk Management"],
    skillAllowPatterns: [/project/i, /agile/i, /scrum/i, /pmp/i, /stakeholder/i],
  },
  {
    id: "sales",
    domain: "business",
    titlePatterns: [/\baccount executive\b/i, /\bsales (manager|representative|rep|director)\b/i, /\bbdr\b/i, /\bsdr\b/i],
    keywords: [/\bquota\b/i, /\bpipeline\b/i, /\bcrm\b/i, /\bclosing\b/i],
    relatedTitles: ["Account Executive", "Sales Manager", "Sales Representative", "Business Development Representative"],
    coreSkills: ["Salesforce", "Solution Selling", "Pipeline Management", "CRM"],
    skillAllowPatterns: [/sales/i, /salesforce/i, /crm/i, /quota/i],
  },
  {
    id: "marketing",
    domain: "business",
    titlePatterns: [/\bmarketing (manager|specialist|director|coordinator)\b/i, /\bgrowth (marketer|manager)\b/i, /\bseo\b/i],
    keywords: [/\bcampaign\b/i, /\bseo\b/i, /\bcontent marketing\b/i, /\bdemand gen/i],
    relatedTitles: ["Marketing Manager", "Growth Marketer", "Content Marketing Manager", "SEO Specialist"],
    coreSkills: ["SEO", "Content Marketing", "Google Analytics", "Campaign Management"],
    skillAllowPatterns: [/marketing/i, /\bseo\b/i, /analytics/i, /campaign/i, /hubspot/i],
  },
  {
    id: "human-resources",
    domain: "business",
    titlePatterns: [/\bhuman resources\b/i, /\bhr (manager|generalist|business partner|coordinator)\b/i, /\brecruiter\b/i],
    keywords: [/\bonboarding\b/i, /\bemployee relations\b/i, /\bats\b/i, /\bcompensation\b/i],
    relatedTitles: ["HR Manager", "HR Generalist", "HR Business Partner", "Recruiter"],
    coreSkills: ["Employee Relations", "Talent Acquisition", "HRIS", "Onboarding"],
    skillAllowPatterns: [/\bhr\b/i, /recruit/i, /onboarding/i, /hris/i, /compensation/i],
  },
  {
    id: "operations",
    domain: "business",
    titlePatterns: [/\boperations manager\b/i, /\bops manager\b/i, /\boperations analyst\b/i, /\bsupply chain\b/i],
    keywords: [/\blogistics\b/i, /\bprocess improvement\b/i, /\bkpi\b/i, /\bsla\b/i],
    relatedTitles: ["Operations Manager", "Operations Analyst", "Supply Chain Manager"],
    coreSkills: ["Process Improvement", "Operations Management", "KPI Reporting", "Excel"],
    skillAllowPatterns: [/operations/i, /logistics/i, /supply chain/i, /process/i],
  },
  {
    id: "customer-success",
    domain: "business",
    titlePatterns: [
      /\bcustomer success\b/i,
      /\bcustomer support\b/i,
      /\baccount manager\b/i,
      /\bimplementation specialist\b/i,
    ],
    keywords: [/\bretention\b/i, /\bonboarding\b/i, /\bnps\b/i, /\bcsm\b/i],
    relatedTitles: ["Customer Success Manager", "Account Manager", "Customer Support Specialist"],
    coreSkills: ["Customer Success", "Account Management", "Salesforce", "Onboarding"],
    skillAllowPatterns: [/customer/i, /account management/i, /salesforce/i, /zendesk/i],
  },
];

const GENERIC_FAMILY: JobFamilyTemplate = {
  id: "generic",
  domain: "generic",
  titlePatterns: [],
  keywords: [],
  relatedTitles: [],
  coreSkills: [],
};

export function matchJobFamily(title: string, description?: string | null): JobFamilyTemplate {
  const titleText = title.trim();

  for (const template of JOB_FAMILY_TEMPLATES) {
    if (template.titlePatterns.some((pattern) => pattern.test(titleText))) {
      return template;
    }
  }

  const corpus = `${titleText} ${description ?? ""}`;
  let best: JobFamilyTemplate = GENERIC_FAMILY;
  let bestScore = 0;

  for (const template of JOB_FAMILY_TEMPLATES) {
    let score = 0;
    for (const keyword of template.keywords) {
      if (keyword.test(corpus)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  if (bestScore > 0) return best;

  return {
    ...GENERIC_FAMILY,
    relatedTitles: titleText ? [titleText] : [],
  };
}

export function titleCollidesWithOtherFamily(title: string, family: JobFamilyTemplate): boolean {
  for (const other of JOB_FAMILY_TEMPLATES) {
    if (other.id === family.id) continue;
    if (other.domain === family.domain) continue;
    if (other.titlePatterns.some((pattern) => pattern.test(title))) return true;
  }
  return false;
}

export function titleBelongsToFamily(title: string, family: JobFamilyTemplate): boolean {
  const lower = title.toLowerCase();
  if (family.relatedTitles.some((related) => related.toLowerCase() === lower)) return true;
  if (family.titlePatterns.some((pattern) => pattern.test(title))) return true;
  if (titleCollidesWithOtherFamily(title, family)) return false;
  return family.id === "generic";
}

/** Alternative titles from the same job family only. 3–10 variants. */
export function expandJobTitles(
  primaryTitle: string,
  family: JobFamilyTemplate,
  extraVariants: string[] = [],
): string[] {
  const titles = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (titleCollidesWithOtherFamily(trimmed, family) && trimmed.toLowerCase() !== primaryTitle.toLowerCase()) {
      return;
    }
    titles.add(trimmed);
  };

  add(primaryTitle);
  for (const variant of extraVariants) add(variant);
  for (const related of family.relatedTitles) add(related);

  const result = [...titles];
  const primary = result.find((title) => title.toLowerCase() === primaryTitle.toLowerCase());
  const rest = result.filter((title) => title.toLowerCase() !== primaryTitle.toLowerCase());
  return [primary ?? primaryTitle, ...rest].slice(0, 10);
}
