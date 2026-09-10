"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultFeaturesForRole, filterNavSections } from "@/lib/auth/features";
import { HeadsbaseLogo } from "@/components/brand/headsbase-logo";
import type { MemberRole } from "@prisma/client";

export function SidebarNav({
  badges = {},
  role = "RECRUITER",
  features,
}: {
  user?: { name: string; image?: string | null; role?: string };
  badges?: Record<string, number>;
  role?: MemberRole;
  features?: string[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const sections = filterNavSections(features ?? defaultFeaturesForRole(role), role);

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[#0b1f3a] text-slate-200 transition-all duration-200",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className="flex h-14 items-center border-b border-white/10 px-3">
        <HeadsbaseLogo collapsed={collapsed} className="flex-1" />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed && (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                const badge = badges[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-[#2563eb] font-medium text-white"
                          : "text-slate-300 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && badge !== undefined && badge > 0 && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
