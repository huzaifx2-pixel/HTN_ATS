"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Plus, Search, Users, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Create Job", href: "/jobs/create", icon: Plus },
  { label: "Talent Search", href: "/candidates/search", icon: Search },
  { label: "Candidates", href: "/candidates", icon: Users },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
];

export function StickyActionBar() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur">
        {QUICK_ACTIONS.map((action) => {
          const active = pathname === action.href || pathname.startsWith(`${action.href}/`);
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-brand-700 text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <action.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
