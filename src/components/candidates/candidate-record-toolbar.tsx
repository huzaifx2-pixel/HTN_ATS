"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Download, Globe, Mail, Pencil, Phone } from "lucide-react";
import { CandidateListNav } from "@/components/candidates/candidate-list-nav";
import { CandidateHardDeleteButton } from "@/components/candidates/candidate-hard-delete-button";
import { cn } from "@/lib/utils";

function ToolbarButton({
  href,
  title,
  disabled,
  children,
}: {
  href?: string;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex h-8 flex-col items-center justify-center gap-0 rounded px-2 text-[10px] font-medium leading-tight",
    disabled
      ? "pointer-events-none text-[#9aa8b8]"
      : "text-[#1e4e8c] hover:bg-white",
  );

  if (disabled || !href) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }

  const external = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
  if (external) {
    return (
      <a href={href} className={className} title={title} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}

export function CandidateRecordToolbar({
  candidateId,
  email,
  phoneHref,
  linkedIn,
  downloadUrl,
  fileName,
}: {
  candidateId: string;
  email?: string | null;
  phoneHref?: string | null;
  linkedIn?: string | null;
  downloadUrl?: string | null;
  fileName?: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[#b8c4d4] bg-[#e8eef5] px-2 py-1">
      <Suspense fallback={null}>
        <CandidateListNav candidateId={candidateId} variant="back" />
      </Suspense>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto">
        <ToolbarButton href={`/candidates/${candidateId}?tab=edit`} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </ToolbarButton>
        <ToolbarButton href={`/candidates/${candidateId}?tab=email`} title="Email" disabled={!email}>
          <Mail className="h-3.5 w-3.5" />
          Email
        </ToolbarButton>
        <ToolbarButton href={phoneHref ?? undefined} title="Call" disabled={!phoneHref}>
          <Phone className="h-3.5 w-3.5" />
          Call
        </ToolbarButton>
        <ToolbarButton href={linkedIn ?? undefined} title="LinkedIn" disabled={!linkedIn}>
          <Globe className="h-3.5 w-3.5" />
          LinkedIn
        </ToolbarButton>
        <ToolbarButton href={downloadUrl ?? undefined} title="Download" disabled={!downloadUrl}>
          <Download className="h-3.5 w-3.5" />
          Download
        </ToolbarButton>
        <CandidateHardDeleteButton candidateId={candidateId} />
        {downloadUrl && fileName ? (
          <span className="sr-only">{fileName}</span>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <CandidateListNav candidateId={candidateId} variant="pager" />
      </Suspense>
    </div>
  );
}
