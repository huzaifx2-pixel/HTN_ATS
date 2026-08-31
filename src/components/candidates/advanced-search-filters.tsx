"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  filtersToSearchParams,
  parseCandidateSearchFilters,
  type CandidateSearchFilters,
} from "@/lib/search/candidate-filters";
import type { CandidateSearchMode } from "@/lib/services/search-utils";

import type { CandidateSearchFacets } from "@/lib/search/search-facets";

export function AdvancedSearchFilters({
  initialFilters,
  mode,
  facets,
}: {
  initialFilters: CandidateSearchFilters;
  mode: CandidateSearchMode;
  facets?: CandidateSearchFacets;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateField(key: keyof CandidateSearchFilters, value: string) {
    const current = parseCandidateSearchFilters(Object.fromEntries(searchParams.entries()));
    const next = { ...current, mode, [key]: value || undefined };
    const params = new URLSearchParams(filtersToSearchParams(next));
    router.push(`/candidates/search?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border rounded-lg p-4 bg-muted/20">
      <div>
        <Label className="text-xs">Skills (comma-separated)</Label>
        <Input
          className="mt-1 h-8 text-xs"
          defaultValue={initialFilters.skills?.join(", ") ?? ""}
          placeholder="Java, AWS, React"
          onBlur={(e) => {
            const skills = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            const current = parseCandidateSearchFilters(Object.fromEntries(searchParams.entries()));
            const params = new URLSearchParams(
              filtersToSearchParams({ ...current, mode, skills: skills.length ? skills : undefined }),
            );
            router.push(`/candidates/search?${params.toString()}`);
          }}
        />
      </div>
      <div>
        <Label className="text-xs">Location</Label>
        <Input
          className="mt-1 h-8 text-xs"
          defaultValue={initialFilters.location ?? ""}
          list="facet-locations"
          onBlur={(e) => updateField("location", e.target.value)}
        />
        {facets?.locations.length ? (
          <datalist id="facet-locations">
            {facets.locations.map((item) => (
              <option key={item.value} value={item.value} />
            ))}
          </datalist>
        ) : null}
      </div>
      <div>
        <Label className="text-xs">City</Label>
        <Input className="mt-1 h-8 text-xs" defaultValue={initialFilters.city ?? ""} onBlur={(e) => updateField("city", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Country</Label>
        <Input className="mt-1 h-8 text-xs" defaultValue={initialFilters.country ?? ""} onBlur={(e) => updateField("country", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Current company</Label>
        <Input
          className="mt-1 h-8 text-xs"
          defaultValue={initialFilters.company ?? ""}
          list="facet-companies"
          onBlur={(e) => updateField("company", e.target.value)}
        />
        {facets?.companies.length ? (
          <datalist id="facet-companies">
            {facets.companies.map((item) => (
              <option key={item.value} value={item.value} />
            ))}
          </datalist>
        ) : null}
      </div>
      <div>
        <Label className="text-xs">Visa / work authorization</Label>
        <Input className="mt-1 h-8 text-xs" defaultValue={initialFilters.workAuthorization ?? ""} onBlur={(e) => updateField("workAuthorization", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Min experience (years)</Label>
        <Input type="number" className="mt-1 h-8 text-xs" defaultValue={initialFilters.minExperience ?? ""} onBlur={(e) => {
          const current = parseCandidateSearchFilters(Object.fromEntries(searchParams.entries()));
          const params = new URLSearchParams(filtersToSearchParams({
            ...current, mode, minExperience: e.target.value ? Number(e.target.value) : undefined,
          }));
          router.push(`/candidates/search?${params.toString()}`);
        }} />
      </div>
      <div>
        <Label className="text-xs">Education</Label>
        <Input className="mt-1 h-8 text-xs" defaultValue={initialFilters.education ?? ""} onBlur={(e) => updateField("education", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Title</Label>
        <Input
          className="mt-1 h-8 text-xs"
          defaultValue={initialFilters.title ?? ""}
          list="facet-titles"
          onBlur={(e) => updateField("title", e.target.value)}
        />
        {facets?.titles.length ? (
          <datalist id="facet-titles">
            {facets.titles.map((item) => (
              <option key={item.value} value={item.value} />
            ))}
          </datalist>
        ) : null}
      </div>
      <div>
        <Label className="text-xs">Certification</Label>
        <Input className="mt-1 h-8 text-xs" defaultValue={initialFilters.certification ?? ""} onBlur={(e) => updateField("certification", e.target.value)} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(`/candidates/search?mode=${mode}`)}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
