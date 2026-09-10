import type { LucideIcon } from "lucide-react";
import { FEATURE_SECTIONS } from "@/lib/auth/features";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  feature: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const EXECUTIVE_NAV: NavSection[] = FEATURE_SECTIONS.map((section) => ({
  title: section.title,
  items: section.items.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    feature: item.key,
  })),
}));
