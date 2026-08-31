import { Suspense } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CandidateListNav } from "@/components/candidates/candidate-list-nav";

export const CANDIDATE_RECORD_TABS = [
  { key: "resume", label: "Resume" },
  { key: "matches", label: "Matches" },
  { key: "email", label: "Saved Email" },
  { key: "activity", label: "Tasks" },
  { key: "applications", label: "Onboard" },
  { key: "parse", label: "Parse" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "duplicates", label: "Duplicates" },
  { key: "edit", label: "Edit" },
] as const;

export type CandidateRecordTab = (typeof CANDIDATE_RECORD_TABS)[number]["key"];

export function normalizeCandidateTab(value?: string | null): CandidateRecordTab {
  if (value === "profile" || value === "resumes") return "resume";
  if (value === "timeline") return "activity";
  if (CANDIDATE_RECORD_TABS.some((tab) => tab.key === value)) {
    return value as CandidateRecordTab;
  }
  return "resume";
}

export function CandidateRecordLayout({
  candidateId,
  activeTab,
  sidebar,
  children,
}: {
  candidateId: string;
  activeTab: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="-m-5 flex h-[calc(100vh-7.25rem)] min-h-[560px] overflow-hidden border border-[#b8c4d4] bg-[#dce3ea] md:-m-6">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#b8c4d4] bg-[#e8eef5] px-2 py-1">
          <Suspense fallback={null}>
            <CandidateListNav candidateId={candidateId} variant="toolbar" />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-[#b8c4d4] bg-[#eef3f8]">
          {CANDIDATE_RECORD_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/candidates/${candidateId}?tab=${tab.key}`}
              className={cn(
                "whitespace-nowrap border-r border-[#c5d0dc] px-3 py-2 text-[12px]",
                activeTab === tab.key
                  ? "bg-white font-semibold text-[#1e4e8c] shadow-[inset_0_2px_0_#1e4e8c]"
                  : "text-[#3d4f63] hover:bg-white/70",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
