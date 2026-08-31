"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Filter, Bookmark, Info, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS = [
  { key: "all", label: "All Candidates", href: "/candidates" },
  { key: "pool", label: "Talent Pool", href: "/candidates/pool" },
  { key: "search", label: "Talent Search", href: "/candidates/search" },
  { key: "inbox", label: "Resume Inbox", href: "/candidates/inbox" },
  { key: "recycle", label: "Archived", href: "/candidates/recycle" },
] as const;

export function CandidatesPageShell({
  totalLabel,
  children,
}: {
  totalLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[#0f172a]">Candidates</h1>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{totalLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/candidates/upload">
              <Upload className="h-4 w-4" /> Import
            </Link>
          </Button>
          <Button size="sm" className="bg-[#2563eb] hover:bg-[#1d4ed8]" asChild>
            <Link href="/candidates/new">
              <Plus className="h-4 w-4" /> Add Candidate
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
                active
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3 shadow-sm">
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href="/candidates/search">
            <Filter className="h-3.5 w-3.5" /> Advanced Search
          </Link>
        </Button>
        {["Skills", "Location", "Experience", "Title"].map((filter) => (
          <button
            key={filter}
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            {filter}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            Clear All
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
            <Link href="/candidates/search">
              <Bookmark className="h-3.5 w-3.5" /> Save Search
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">{children}</div>
    </div>
  );
}

export function CandidateProfileShell({
  candidateId,
  name,
  title,
  status,
  email,
  phone,
  location,
  engaged,
  activeTab,
  children,
  sidebar,
}: {
  candidateId: string;
  name: string;
  title?: string | null;
  status: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  engaged: boolean;
  activeTab: string;
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const tabs = [
    { key: "profile", label: "Overview" },
    { key: "parse", label: "Parse review" },
    { key: "timeline", label: "Timeline" },
    { key: "resumes", label: "Resume" },
    { key: "duplicates", label: "Duplicates" },
    { key: "edit", label: "Edit" },
  ];

  const statusColor =
    status === "engaged" || engaged
      ? "bg-emerald-100 text-emerald-800"
      : "bg-blue-100 text-blue-800";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/candidates" className="text-[#2563eb] hover:underline">
          ← Back to Candidates
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2563eb]/10 text-xl font-semibold text-[#2563eb]">
            {name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{name}</h1>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor)}>
                {engaged ? "In Process" : "New"}
              </span>
            </div>
            {title ? <p className="text-sm text-muted-foreground mt-0.5">{title}</p> : null}
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {email ? <span>{email}</span> : null}
              {phone ? <span>{phone}</span> : null}
              {location ? <span>{location}</span> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-[#2563eb] hover:bg-[#1d4ed8]" asChild>
              <Link href={`/candidates/${candidateId}?tab=profile`}>Email</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/candidates/${candidateId}?tab=edit`}>More Actions</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/candidates/${candidateId}?tab=${tab.key}`}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2 text-sm -mb-px transition-colors",
                activeTab === tab.key
                  ? "border-[#2563eb] font-medium text-[#2563eb]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">{children}</div>
        <div className="space-y-4">{sidebar}</div>
      </div>
    </div>
  );
}
