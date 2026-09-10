import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Building2,
  Contact,
  Database,
  FileText,
  FolderUp,
  Inbox,
  Key,
  LayoutDashboard,
  LineChart,
  Mail,
  Megaphone,
  Plus,
  Plug,
  ScanText,
  ScrollText,
  Search,
  Settings,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import type { MemberRole } from "@prisma/client";
import type { Permission } from "@/lib/auth/session-types";

export const FEATURE_ROLES = ["ADMIN", "RECRUITER", "EXTERNAL_RECRUITER"] as const;
export type EditableFeatureRole = (typeof FEATURE_ROLES)[number];

export const MATRIX_ROLES = ["OWNER", ...FEATURE_ROLES] as const;
export type MatrixRole = (typeof MATRIX_ROLES)[number];

export const ROLE_COLUMN_META: Record<
  MatrixRole,
  { label: string; description: string }
> = {
  OWNER: { label: "Superadmin", description: "Full access to all features." },
  ADMIN: { label: "Admin", description: "Manage operations." },
  RECRUITER: { label: "Recruiter", description: "Day-to-day recruiting." },
  EXTERNAL_RECRUITER: { label: "External Recruiter", description: "Limited access." },
};

export type FeatureItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  locked?: boolean;
  permissions: Permission[];
};

export type FeatureSection = {
  id: string;
  title: string;
  items: FeatureItem[];
};

export const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: "recruiting",
    title: "Recruiting",
    items: [
      { key: "recruiting.dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissions: [] },
      { key: "recruiting.jobs", label: "Jobs", href: "/jobs", icon: Briefcase, permissions: ["edit_job", "move_pipeline"] },
      { key: "recruiting.new_job", label: "New Job", href: "/jobs/create", icon: Plus, permissions: ["create_job", "edit_job"] },
      { key: "recruiting.job_templates", label: "Job Templates", href: "/jobs/templates", icon: FileText, permissions: ["create_job", "edit_job"] },
      { key: "recruiting.job_activity", label: "Job Activity", href: "/jobs/activity", icon: Activity, permissions: ["edit_job"] },
      { key: "recruiting.import_jobs", label: "Import Jobs", href: "/jobs/import", icon: Upload, permissions: ["create_job"] },
      { key: "recruiting.candidates", label: "Candidates", href: "/candidates", icon: Users, permissions: ["edit_job", "move_pipeline", "send_email"] },
      { key: "recruiting.matching", label: "Matching Candidates", href: "/matching", icon: UserCheck, permissions: ["edit_job", "create_job"] },
      { key: "recruiting.talent_pool", label: "Talent Pool", href: "/candidates/pool", icon: Database, permissions: ["edit_job"] },
      { key: "recruiting.talent_search", label: "Talent Search", href: "/candidates/search", icon: Search, permissions: ["edit_job"] },
      { key: "recruiting.resume_inbox", label: "Resume Inbox", href: "/candidates/inbox", icon: Inbox, permissions: ["edit_job"] },
      { key: "recruiting.bulk_upload", label: "Bulk Upload", href: "/candidates/upload", icon: FolderUp, permissions: ["edit_job"] },
    ],
  },
  {
    id: "crm",
    title: "CRM",
    items: [
      { key: "crm.companies", label: "Companies", href: "/admin/clients", icon: Building2, permissions: [] },
      { key: "crm.contacts", label: "Contacts", href: "/crm/contacts", icon: Contact, permissions: ["edit_job"] },
      { key: "crm.opportunities", label: "Opportunities", href: "/crm/opportunities", icon: Target, permissions: ["edit_job"] },
      { key: "crm.activity", label: "Activity Center", href: "/activity", icon: Activity, permissions: [] },
    ],
  },
  {
    id: "outreach",
    title: "Outreach",
    items: [
      { key: "outreach.campaigns", label: "Campaigns", href: "/marketing/campaigns", icon: Megaphone, permissions: ["manage_marketing", "send_email"] },
      { key: "outreach.audiences", label: "Audiences", href: "/marketing/audiences", icon: Users, permissions: ["manage_marketing", "send_email"] },
      { key: "outreach.templates", label: "Templates", href: "/marketing/templates", icon: Mail, permissions: ["manage_marketing", "send_email"] },
      { key: "outreach.automations", label: "Automations", href: "/marketing/automations", icon: Zap, permissions: ["manage_marketing", "send_email"] },
    ],
  },
  {
    id: "ai",
    title: "AI",
    items: [
      { key: "ai.ask", label: "Ask ATS", href: "/ask", icon: Sparkles, permissions: [] },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    items: [
      { key: "analytics.overview", label: "Overview", href: "/analytics", icon: LineChart, permissions: ["view_analytics"] },
      { key: "analytics.parser", label: "Parser", href: "/analytics/parser", icon: ScanText, permissions: ["view_analytics"] },
      { key: "analytics.recruiters", label: "Recruiters", href: "/analytics/recruiters", icon: TrendingUp, permissions: ["view_analytics"] },
      { key: "analytics.email", label: "Email Performance", href: "/analytics/email", icon: Mail, permissions: ["view_analytics"] },
    ],
  },
  {
    id: "administration",
    title: "Administration",
    items: [
      { key: "admin.users", label: "Users", href: "/admin/users", icon: Users, locked: true, permissions: ["manage_users", "admin"] },
      { key: "admin.roles", label: "Roles & Permissions", href: "/admin/roles", icon: Key, locked: true, permissions: ["manage_users", "admin"] },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { key: "settings.org", label: "Settings", href: "/settings", icon: Settings, permissions: ["admin", "manage_org"] },
      { key: "settings.integrations", label: "Integrations", href: "/admin/integrations", icon: Plug, permissions: ["admin"] },
      { key: "settings.audit_logs", label: "Audit Logs", href: "/admin/logs", icon: ScrollText, permissions: ["admin"] },
    ],
  },
  {
    id: "internal",
    title: "Internal Tools",
    items: [
      { key: "internal.micro1_referrals", label: "micro1 Referrals", href: "/referrals", icon: Share2, permissions: ["edit_job"] },
    ],
  },
];

export const ALL_FEATURE_ITEMS = FEATURE_SECTIONS.flatMap((section) => section.items);
export const ALL_FEATURE_KEYS = ALL_FEATURE_ITEMS.map((item) => item.key);
export const LOCKED_FEATURE_KEYS = ALL_FEATURE_ITEMS.filter((item) => item.locked).map((item) => item.key);
export const GRANTABLE_FEATURE_KEYS = ALL_FEATURE_ITEMS.filter((item) => !item.locked).map((item) => item.key);

const FEATURE_BY_KEY = new Map(ALL_FEATURE_ITEMS.map((item) => [item.key, item]));

const PATH_ALIASES: Array<{ prefix: string; feature: string }> = [
  { prefix: "/jobs/create", feature: "recruiting.new_job" },
  { prefix: "/jobs/templates", feature: "recruiting.job_templates" },
  { prefix: "/jobs/activity", feature: "recruiting.job_activity" },
  { prefix: "/jobs/import", feature: "recruiting.import_jobs" },
  { prefix: "/jobs", feature: "recruiting.jobs" },
  { prefix: "/candidates/pool", feature: "recruiting.talent_pool" },
  { prefix: "/candidates/search", feature: "recruiting.talent_search" },
  { prefix: "/candidates/inbox", feature: "recruiting.resume_inbox" },
  { prefix: "/candidates/upload", feature: "recruiting.bulk_upload" },
  { prefix: "/candidates", feature: "recruiting.candidates" },
  { prefix: "/matching", feature: "recruiting.matching" },
  { prefix: "/search", feature: "recruiting.talent_search" },
  { prefix: "/ask", feature: "ai.ask" },
  { prefix: "/admin/clients", feature: "crm.companies" },
  { prefix: "/crm/contacts", feature: "crm.contacts" },
  { prefix: "/crm/opportunities", feature: "crm.opportunities" },
  { prefix: "/activity", feature: "crm.activity" },
  { prefix: "/marketing/campaigns", feature: "outreach.campaigns" },
  { prefix: "/marketing/audiences", feature: "outreach.audiences" },
  { prefix: "/marketing/templates", feature: "outreach.templates" },
  { prefix: "/marketing/automations", feature: "outreach.automations" },
  { prefix: "/marketing", feature: "outreach.campaigns" },
  { prefix: "/analytics/parser", feature: "analytics.parser" },
  { prefix: "/analytics/recruiters", feature: "analytics.recruiters" },
  { prefix: "/analytics/email", feature: "analytics.email" },
  { prefix: "/analytics", feature: "analytics.overview" },
  { prefix: "/admin/users", feature: "admin.users" },
  { prefix: "/admin/roles", feature: "admin.roles" },
  { prefix: "/admin/integrations", feature: "settings.integrations" },
  { prefix: "/admin/logs", feature: "settings.audit_logs" },
  { prefix: "/settings", feature: "settings.org" },
  { prefix: "/referrals", feature: "internal.micro1_referrals" },
  { prefix: "/dashboard", feature: "recruiting.dashboard" },
];

const OPEN_PATH_PREFIXES = ["/messages", "/settings/profile"];

export const DEFAULT_ROLE_FEATURES: Record<EditableFeatureRole, string[]> = {
  ADMIN: [
    ...FEATURE_SECTIONS.find((s) => s.id === "recruiting")!.items.map((i) => i.key),
    ...FEATURE_SECTIONS.find((s) => s.id === "crm")!.items.map((i) => i.key),
    "ai.ask",
    ...FEATURE_SECTIONS.find((s) => s.id === "analytics")!.items.map((i) => i.key),
    "settings.org",
    "settings.integrations",
  ],
  RECRUITER: [
    "recruiting.dashboard",
    "recruiting.jobs",
    "recruiting.job_activity",
    "recruiting.candidates",
    "recruiting.talent_pool",
    "recruiting.talent_search",
    "recruiting.resume_inbox",
    "ai.ask",
  ],
  EXTERNAL_RECRUITER: [],
};

const LEGACY_ROLE_FEATURES: Partial<Record<MemberRole, string[]>> = {
  MANAGER: DEFAULT_ROLE_FEATURES.ADMIN,
  MARKETING: [
    "recruiting.dashboard",
    "outreach.campaigns",
    "outreach.audiences",
    "outreach.templates",
    "outreach.automations",
    "analytics.overview",
    "analytics.email",
  ],
  FINANCE: ["recruiting.dashboard", "analytics.overview"],
  VIEWER: ["recruiting.dashboard", "analytics.overview"],
};

export function defaultFeaturesForRole(role: MemberRole): string[] {
  if (role === "OWNER") return ALL_FEATURE_KEYS;
  if (role === "ADMIN" || role === "RECRUITER" || role === "EXTERNAL_RECRUITER") {
    return DEFAULT_ROLE_FEATURES[role];
  }
  return LEGACY_ROLE_FEATURES[role] ?? [];
}

export function isSuperadminRole(role: MemberRole) {
  return role === "OWNER";
}

export function featureItem(key: string) {
  return FEATURE_BY_KEY.get(key);
}

export function permissionsForFeatures(features: Iterable<string>): Set<Permission> {
  const permissions = new Set<Permission>();
  for (const key of features) {
    const item = FEATURE_BY_KEY.get(key);
    if (!item) continue;
    for (const permission of item.permissions) permissions.add(permission);
  }
  return permissions;
}

export function featureForPath(pathname: string): string | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (OPEN_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null;
  }
  for (const alias of PATH_ALIASES) {
    if (path === alias.prefix || path.startsWith(`${alias.prefix}/`)) {
      return alias.feature;
    }
  }
  return null;
}

export function canAccessPath(pathname: string, features: Iterable<string>, role: MemberRole) {
  if (isSuperadminRole(role)) return true;
  const feature = featureForPath(pathname);
  if (!feature) return true;
  return new Set(features).has(feature);
}

export function firstAccessibleHref(features: Iterable<string>, role: MemberRole) {
  if (isSuperadminRole(role)) return "/dashboard";
  const granted = new Set(features);
  const dashboard = granted.has("recruiting.dashboard") ? "/dashboard" : null;
  if (dashboard) return dashboard;
  for (const item of ALL_FEATURE_ITEMS) {
    if (granted.has(item.key)) return item.href;
  }
  return "/dashboard";
}

export function filterNavSections(features: Iterable<string>, role: MemberRole) {
  if (isSuperadminRole(role)) return FEATURE_SECTIONS;
  const granted = new Set(features);
  return FEATURE_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => granted.has(item.key)),
  })).filter((section) => section.items.length > 0);
}

export function displayRoleLabel(role: MemberRole) {
  if (role === "OWNER") return "Superadmin";
  if (role === "EXTERNAL_RECRUITER") return "External Recruiter";
  if (role === "ADMIN") return "Admin";
  if (role === "RECRUITER") return "Recruiter";
  return role.charAt(0) + role.slice(1).toLowerCase();
}
