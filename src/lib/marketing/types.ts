import type {
  MarketingAutomationTrigger,
  MarketingCampaignStatus,
  MarketingCampaignType,
  MarketingRecurrence,
  MarketingScheduleType,
  MarketingTemplateCategory,
} from "@prisma/client";

export type { MarketingCampaignType };

export type EmailBlockType =
  | "header"
  | "hero"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "featured_jobs"
  | "featured_candidates"
  | "event"
  | "cta"
  | "testimonial"
  | "video"
  | "social"
  | "footer"
  | "unsubscribe"
  | "html";

export type EmailBlock = {
  id: string;
  type: EmailBlockType;
  content?: string;
  props?: Record<string, string | number | boolean | string[] | undefined>;
};

export type AudienceFilters = {
  sourceType?: "candidates" | "import";
  skills?: string[];
  jobTitle?: string;
  location?: string;
  country?: string;
  state?: string;
  city?: string;
  status?: string[];
  source?: string[];
  minExperience?: number;
  maxExperience?: number;
  tags?: string[];
  pipelineStage?: string[];
  keywords?: string;
  inactiveDays?: number;
  hasEmail?: boolean;
  candidateIds?: string[];
};

export type ImportedContactMeta = {
  contactName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  company?: string;
};

export type MarketingAudienceRecipient = {
  candidateId?: string;
  email: string;
  name: string;
  importMeta?: ImportedContactMeta;
};

export type CampaignWizardInput = {
  name: string;
  internalNotes?: string;
  type: MarketingCampaignType;
  audienceId?: string;
  manualCandidateIds?: string[];
  subject: string;
  preheader?: string;
  designJson: EmailBlock[];
  htmlContent: string;
  scheduleType: MarketingScheduleType;
  scheduledAt?: string;
  recurrence?: MarketingRecurrence;
};

export type MarketingDashboardStats = {
  emailsSent: number;
  delivered: number;
  openRate: number;
  clickRate: number;
  applicationsGenerated: number;
  unsubscribes: number;
  bounceRate: number;
  activeCampaigns: number;
};

export type CampaignListItem = {
  id: string;
  name: string;
  type: MarketingCampaignType;
  status: MarketingCampaignStatus;
  audienceSize: number;
  openRate: number;
  clickRate: number;
  sentAt: Date | null;
  createdAt: Date;
};

export const CAMPAIGN_TYPE_LABELS: Record<MarketingCampaignType, string> = {
  JOB_BLAST: "Job Blast",
  NEWSLETTER: "Newsletter",
  HIRING_EVENT: "Hiring Event",
  EMPLOYER_BRANDING: "Employer Branding",
  REFERRAL: "Referral Campaign",
  RE_ENGAGEMENT: "Candidate Re-engagement",
  CUSTOM: "Custom",
};

export const TEMPLATE_CATEGORY_LABELS: Record<MarketingTemplateCategory, string> = {
  JOB_BLAST: "Job Blast",
  NEWSLETTER: "Newsletter",
  HIRING_EVENT: "Hiring Event",
  REFERRAL: "Referral",
  REACTIVATION: "Reactivation",
  EMPLOYER_BRANDING: "Employer Branding",
  SUCCESS_STORY: "Success Stories",
  CUSTOM: "Custom",
};

export const AUTOMATION_TRIGGER_LABELS: Record<MarketingAutomationTrigger, string> = {
  CANDIDATE_CREATED: "Candidate Created",
  APPLICATION_SUBMITTED: "Application Submitted",
  CANDIDATE_HIRED: "Candidate Hired",
  CANDIDATE_REJECTED: "Candidate Rejected",
  NO_ACTIVITY: "No Activity",
  EVENT_REGISTRATION: "Event Registration",
  MANUAL: "Manual Trigger",
};

export const MARKETING_MERGE_FIELDS = [
  "{{FirstName}}",
  "{{LastName}}",
  "{{FullName}}",
  "{{Email}}",
  "{{Phone}}",
  "{{CurrentCompany}}",
  "{{CurrentJobTitle}}",
  "{{Location}}",
  "{{RecruiterName}}",
  "{{CandidateId}}",
  "{{UnsubscribeLink}}",
  "{{UnsubscribeUrl}}",
] as const;
