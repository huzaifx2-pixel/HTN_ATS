"use client";

import { useEffect } from "react";
import {
  formatRecentSearchLabel,
  recordRecentTalentSearch,
} from "@/lib/candidates/recent-talent-searches";
import { filtersToSearchParams, type CandidateSearchFilters } from "@/lib/search/candidate-filters";

export function RegisterRecentTalentSearch({
  userId,
  filters,
  sourcingJobLabel,
  cursor,
}: {
  userId: string;
  filters: CandidateSearchFilters;
  sourcingJobLabel?: string;
  cursor?: string;
}) {
  const params = filtersToSearchParams(filters);
  const href = `/candidates/search?${new URLSearchParams(params).toString()}`;
  const extras = [
    filters.location,
    filters.city,
    filters.country,
    filters.company,
    filters.skills?.join(", "),
    filters.title,
  ].filter((value): value is string => Boolean(value));
  const label = formatRecentSearchLabel({
    query: filters.query,
    mode: filters.mode,
    jobLabel: sourcingJobLabel,
    extras,
  });

  useEffect(() => {
    if (cursor) return;
    recordRecentTalentSearch(userId, {
      href,
      label,
      mode: filters.mode ?? "all",
      jobLabel: sourcingJobLabel,
    });
  }, [userId, href, label, filters.mode, sourcingJobLabel, cursor]);

  return null;
}
