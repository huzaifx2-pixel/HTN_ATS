"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Mail, Printer } from "lucide-react";
import { ResumeViewer } from "@/components/shared/feature-components";
import { UpdateResumeForm } from "@/components/candidates/update-resume-form";
import { highlightSkillTerms } from "@/lib/candidates/profile-view-data";
import { formatJobTimestamp } from "@/lib/utils";

const DETAILS_PANEL_KEY = "headsbase.resumeDetailsOpen";

function HighlightedText({ text, skills }: { text: string; skills: string[] }) {
  return (
    <>
      {highlightSkillTerms(text, skills).map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <mark key={index} className="bg-yellow-300 px-0.5 text-inherit">
            {part.mark}
          </mark>
        ),
      )}
    </>
  );
}

export function CandidateResumePane({
  candidateId,
  name,
  title,
  workAuthorization,
  location,
  email,
  phone,
  source,
  createdAt,
  summary,
  skills,
  previewUrl,
  downloadUrl,
  fileName,
  mimeType,
}: {
  candidateId: string;
  name: string;
  title?: string | null;
  workAuthorization?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  createdAt?: Date | string | null;
  summary?: string | null;
  skills: string[];
  previewUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    try {
      const storedDetails = window.sessionStorage.getItem(DETAILS_PANEL_KEY);
      if (storedDetails === "1") setDetailsOpen(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  function toggleDetails() {
    setDetailsOpen((open) => {
      const next = !open;
      try {
        window.sessionStorage.setItem(DETAILS_PANEL_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-[#d7e0ea] bg-[#f7f9fb] px-2 py-1">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]"
          title="Print"
        >
          <Printer className="h-4 w-4" />
        </button>
        <Link href={`/candidates/${candidateId}?tab=email`} className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]" title="Email">
          <Mail className="h-4 w-4" />
        </Link>
        <div className="ml-2">
          <UpdateResumeForm candidateId={candidateId} hasResume={Boolean(previewUrl)} />
        </div>
        <span className="ml-auto truncate pl-2 text-[11px] text-[#4b5d73]" title={fileName ?? undefined}>
          {fileName ?? "No file"}
        </span>
      </div>

      <button
        type="button"
        onClick={toggleDetails}
        className="flex shrink-0 items-center gap-1 border-b border-[#d7e0ea] bg-white px-3 py-1 text-left text-[11px] text-[#4b5d73] hover:bg-[#f7f9fb]"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="truncate">
          {source ? `Source: ${source}` : "Uploaded"}
          {createdAt ? ` · ${formatJobTimestamp(createdAt)}` : ""}
          {title ? ` · ${title}` : ""}
        </span>
      </button>
      {detailsOpen ? (
        <div className="shrink-0 border-b border-[#d7e0ea] bg-white px-4 py-3">
          <div className="space-y-1 text-sm">
            <div className="text-base font-semibold">{name}</div>
            {title ? (
              <div>
                <HighlightedText text={title} skills={skills} />
              </div>
            ) : null}
            {workAuthorization ? (
              <div>
                Work Status: <span className="font-medium">{workAuthorization}</span>
              </div>
            ) : null}
            {location ? <div>{location}</div> : null}
            {email ? (
              <div>
                <a href={`mailto:${email}`} className="text-[#1e4e8c] hover:underline">
                  {email}
                </a>
              </div>
            ) : null}
            {phone ? <div>{phone}</div> : null}
          </div>
          {summary ? (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#1e4e8c]">
                Professional Summary
              </div>
              <p className="text-sm leading-relaxed text-[#1a2b3c]">
                <HighlightedText text={summary} skills={skills} />
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 bg-[#525659]">
        <ResumeViewer
          url={previewUrl}
          downloadUrl={downloadUrl}
          fileName={fileName}
          mimeType={mimeType}
          fill
        />
      </div>
    </div>
  );
}
