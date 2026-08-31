"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/marketing", label: "Dashboard", exact: true },
  { href: "/marketing/campaigns", label: "Campaigns" },
  { href: "/marketing/templates", label: "Templates" },
  { href: "/marketing/designer", label: "Email Designer" },
  { href: "/marketing/audiences", label: "Audiences" },
  { href: "/marketing/automations", label: "Automations" },
  { href: "/marketing/analytics", label: "Analytics" },
  { href: "/marketing/brand", label: "Brand Kit" },
  { href: "/marketing/media", label: "Media Library" },
  { href: "/marketing/settings", label: "Settings" },
];

export function MarketingNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-700 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
