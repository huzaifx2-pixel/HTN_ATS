import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  MapPin,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobShareButton } from "@/components/jobs/detail/job-share-button";
import { cn } from "@/lib/utils";

export function JobDetailHeader({
  jobId,
  title,
  status,
  jobCode,
  clientId,
  clientName,
  location,
  employmentType,
  postedLabel,
  shareUrl,
  activeTab,
}: {
  jobId: string;
  title: string;
  status: string;
  jobCode: string;
  clientId: string;
  clientName: string;
  location: string;
  employmentType?: string | null;
  postedLabel?: string | null;
  shareUrl?: string | null;
  activeTab: string;
}) {
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "matching", label: "Matching" },
    { key: "applicants", label: "Candidates" },
    { key: "pipeline", label: "Pipeline" },
    { key: "activity", label: "Activity" },
    { key: "analytics", label: "Analytics" },
    { key: "documents", label: "Documents" },
    { key: "notes", label: "Notes" },
    { key: "edit", label: "Edit" },
  ];

  const statusLabel =
    status === "OPEN" ? "Published" : status.replaceAll("_", " ");

  return (
    <div className="space-y-4">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {activeTab === "overview" ? (
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                View Only
              </span>
            ) : activeTab === "edit" ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                Editing
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <Link
              href={`/admin/clients?client=${clientId}`}
              className="inline-flex items-center gap-1.5 hover:text-brand-700"
            >
              <Building2 className="h-3.5 w-3.5" /> {clientName}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {location || "Location TBD"}
            </span>
            {employmentType ? (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> {employmentType.replaceAll("_", " ")}
              </span>
            ) : null}
            {postedLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Posted on {postedLabel}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <StatusBadge status={status} />
              <span className="sr-only">{statusLabel}</span>
            </span>
            <span className="font-mono text-xs text-foreground/60">{jobCode}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={activeTab === "edit" ? "default" : "outline"}>
            <Link href={`/jobs/${jobId}?tab=edit`}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
          {shareUrl ? <JobShareButton url={shareUrl} /> : null}
          <Button size="sm" variant="ghost" type="button" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/jobs/${jobId}?tab=${tab.key}`}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              activeTab === tab.key
                ? "border-sky-600 font-medium text-sky-700"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
