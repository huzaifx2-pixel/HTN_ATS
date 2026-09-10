"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { candidateNavPosition, readCandidateNav } from "@/lib/candidates/search-nav";

function backLabel(returnTo?: string | null) {
  if (!returnTo) return "Back to Candidates";
  if (returnTo.includes("/candidates/search")) return "Back to Search";
  if (returnTo.includes("/candidates/pool")) return "Back to Talent Pool";
  if (returnTo.includes("/hotlists")) return "Back to Hotlist";
  return "Back to Candidates";
}

export function CandidateListNav({
  candidateId,
  variant = "compact",
}: {
  candidateId: string;
  variant?: "compact" | "toolbar" | "back" | "pager";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nav, setNav] = useState<ReturnType<typeof candidateNavPosition>>(null);

  useEffect(() => {
    setNav(candidateNavPosition(candidateId, readCandidateNav()));
  }, [candidateId]);

  const tabQuery = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab ? `?tab=${encodeURIComponent(tab)}` : "";
  }, [searchParams]);

  useEffect(() => {
    if (!nav || (variant !== "toolbar" && variant !== "pager")) return;
    const currentNav = nav;

    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (event.key === "ArrowLeft" && currentNav.prevId) {
        event.preventDefault();
        router.push(`/candidates/${currentNav.prevId}${tabQuery}`);
      }
      if (event.key === "ArrowRight" && currentNav.nextId) {
        event.preventDefault();
        router.push(`/candidates/${currentNav.nextId}${tabQuery}`);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, router, tabQuery, variant]);

  if (!nav) {
    if (variant === "back") {
      return (
        <Link
          href="/candidates"
          className="whitespace-nowrap text-[12px] font-medium text-[#1e4e8c] hover:underline"
        >
          Back to Candidates
        </Link>
      );
    }
    return null;
  }

  const prevHref = nav.prevId ? `/candidates/${nav.prevId}${tabQuery}` : null;
  const nextHref = nav.nextId ? `/candidates/${nav.nextId}${tabQuery}` : null;

  if (variant === "back") {
    return (
      <Link
        href={nav.returnTo || "/candidates"}
        className="whitespace-nowrap text-[12px] font-medium text-[#1e4e8c] hover:underline"
      >
        {backLabel(nav.returnTo)}
      </Link>
    );
  }

  if (variant === "pager") {
    return (
      <div className="flex items-center gap-1">
        {prevHref ? (
          <Link
            href={prevHref}
            className="rounded border border-[#c5d0dc] bg-white px-2 py-0.5 text-[11px] font-medium text-[#1e4e8c] hover:bg-[#dce6f2]"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded border border-transparent px-2 py-0.5 text-[11px] font-medium text-[#1e4e8c] opacity-30">
            Previous
          </span>
        )}
        <span className="min-w-[4.5rem] px-1 text-center text-[11px] tabular-nums text-[#4b5d73]">
          {nav.index + 1} of {nav.total}
        </span>
        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded border border-[#1e4e8c] bg-[#1e4e8c] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#163a6a]"
          >
            Next
          </Link>
        ) : (
          <span className="rounded border border-transparent px-2 py-0.5 text-[11px] font-medium text-[#1e4e8c] opacity-30">
            Next
          </span>
        )}
      </div>
    );
  }

  if (variant === "toolbar") {
    return (
      <div className="flex w-full items-center justify-end gap-1">
        {nav.returnTo ? (
          <Link
            href={nav.returnTo}
            className="rounded px-1.5 py-0.5 text-[11px] text-[#1e4e8c] hover:bg-white"
            title="Back to list"
          >
            List
          </Link>
        ) : null}
        {prevHref ? (
          <Link
            href={prevHref}
            className="rounded border border-[#c5d0dc] bg-white px-2 py-0.5 text-[11px] font-medium text-[#1e4e8c] hover:bg-[#dce6f2]"
          >
            Prev
          </Link>
        ) : (
          <span className="rounded border border-transparent px-2 py-0.5 text-[11px] font-medium text-[#1e4e8c] opacity-30">
            Prev
          </span>
        )}
        <span className="min-w-[3.5rem] px-1 text-center text-[11px] tabular-nums text-[#4b5d73]">
          {nav.index + 1} of {nav.total}
        </span>
        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded border border-[#1e4e8c] bg-[#1e4e8c] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#163a6a]"
          >
            Next
          </Link>
        ) : (
          <span className="rounded border border-transparent px-2 py-0.5 text-[11px] font-medium text-[#1e4e8c] opacity-30">
            Next
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center gap-0.5">
      {nav.returnTo ? (
        <Link
          href={nav.returnTo}
          className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]"
          title="Back to list"
        >
          <List className="h-3.5 w-3.5" />
        </Link>
      ) : null}
      {prevHref ? (
        <Link href={prevHref} className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]" title="Previous candidate">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span className="rounded p-1 text-[#1e4e8c] opacity-30">
          <ChevronLeft className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="min-w-[3.25rem] text-center text-[10px] tabular-nums text-[#4b5d73]">
        {nav.index + 1}/{nav.total}
      </span>
      {nextHref ? (
        <Link href={nextHref} className="rounded p-1 text-[#1e4e8c] hover:bg-[#dce6f2]" title="Next candidate">
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span className="rounded p-1 text-[#1e4e8c] opacity-30">
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
