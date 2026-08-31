import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Database,
  Inbox,
  Building2,
  Contact,
  Target,
  Activity,
  Megaphone,
  Mail,
  Zap,
  BarChart3,
  LineChart,
  TrendingUp,
  ScanText,
  Key,
  Settings,
  Plug,
  ScrollText,
  Search,
  FolderUp,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const EXECUTIVE_NAV: NavSection[] = [
  {
    title: "Recruitment",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Jobs", href: "/jobs", icon: Briefcase },
      { label: "Candidates", href: "/candidates", icon: Users },
      { label: "Talent Pool", href: "/candidates/pool", icon: Database },
      { label: "Talent Search", href: "/candidates/search", icon: Search },
      { label: "Resume Inbox", href: "/candidates/inbox", icon: Inbox },
      { label: "Bulk Upload", href: "/candidates/upload", icon: FolderUp },
      { label: "Ask ATS", href: "/ask", icon: Sparkles },
    ],
  },
  {
    title: "CRM",
    items: [
      { label: "Companies", href: "/admin/clients", icon: Building2 },
      { label: "Contacts", href: "/crm/contacts", icon: Contact },
      { label: "Opportunities", href: "/crm/opportunities", icon: Target },
      { label: "Activity Center", href: "/activity", icon: Activity },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
      { label: "Audiences", href: "/marketing/audiences", icon: Users },
      { label: "Templates", href: "/marketing/templates", icon: Mail },
      { label: "Automations", href: "/marketing/automations", icon: Zap },
      { label: "Analytics", href: "/marketing/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Overview", href: "/analytics", icon: LineChart },
      { label: "Parser", href: "/analytics/parser", icon: ScanText },
      { label: "Recruiters", href: "/analytics/recruiters", icon: TrendingUp },
      { label: "Email Performance", href: "/analytics/email", icon: Mail },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Roles & Permissions", href: "/admin/roles", icon: Key },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Integrations", href: "/admin/integrations", icon: Plug },
      { label: "Audit Logs", href: "/admin/logs", icon: ScrollText },
    ],
  },
];
