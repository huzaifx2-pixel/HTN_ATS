"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { CandidateTimeline } from "@/components/candidates/candidate-timeline";
import { UpdateResumeForm } from "@/components/candidates/update-resume-form";
import type { TimelineEvent } from "@/lib/services/candidate-timeline-service";
import { formatJobTimestamp } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ResumeDocument = {
  id: string;
  fileName: string;
  isLatest: boolean;
  createdAt: Date;
  storageKey: string;
};

export function CandidateRecordRail({
  candidateId,
  documents,
  timeline,
}: {
  candidateId: string;
  documents: ResumeDocument[];
  timeline: TimelineEvent[];
}) {
  const [feed, setFeed] = useState<"activity" | "email">("activity");
  const resumes = documents.filter((doc) => doc.storageKey);
  const emailEvents = timeline.filter((event) => event.category === "email");
  const events = feed === "email" ? emailEvents : timeline;

  return (
    <aside className="flex h-full w-[min(260px,28%)] min-w-[220px] shrink-0 flex-col overflow-hidden border-l border-[#b8c4d4] bg-white">
      <section className="shrink-0 border-b border-[#c5d0dc]">
        <div className="flex items-center justify-between bg-[#1e4e8c] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          <span>Resume Versions ({resumes.length})</span>
          <UpdateResumeForm candidateId={candidateId} hasResume={resumes.length > 0} variant="icon" />
        </div>
        {resumes.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">No resume on file.</p>
        ) : (
          <ul className="divide-y divide-[#e6edf4] text-[11px]">
            {resumes.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <a
                  href={`/api/files/${doc.storageKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-[#1e4e8c] hover:underline"
                  title={doc.fileName}
                >
                  {formatJobTimestamp(doc.createdAt)}
                  {doc.isLatest ? " · latest" : ""}
                </a>
                <span className="flex shrink-0 items-center gap-1 text-[#7a8b9c]">
                  <a
                    href={`/api/files/${doc.storageKey}?download=1`}
                    download={doc.fileName}
                    title="Download"
                    className="hover:text-[#1e4e8c]"
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  <Upload className="h-3 w-3" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 border-b border-[#c5d0dc] bg-[#eef3f8] text-[11px]">
          {(
            [
              ["activity", "Activity"],
              ["email", "Emails"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFeed(key)}
              className={cn(
                "flex-1 px-2 py-1.5",
                feed === key
                  ? "bg-white font-semibold text-[#1e4e8c] shadow-[inset_0_2px_0_#1e4e8c]"
                  : "text-[#3d4f63] hover:bg-white/70",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <CandidateTimeline events={events} compact />
        </div>
      </section>
    </aside>
  );
}
