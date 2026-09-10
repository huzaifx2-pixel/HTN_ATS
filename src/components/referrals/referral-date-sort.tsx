"use client";

import { useRouter } from "next/navigation";

export function ReferralDateSort({
  value,
  query,
}: {
  value: "desc" | "asc";
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 font-medium">
      <span>Date Referred</span>
      <select
        aria-label="Sort by date referred"
        value={value}
        className="h-7 rounded-md border border-border bg-card px-1.5 text-xs font-normal text-foreground"
        onChange={(event) => {
          const params = new URLSearchParams();
          for (const [key, item] of Object.entries(query)) {
            if (item) params.set(key, item);
          }
          if (event.target.value === "asc") params.set("sort", "referred_asc");
          else params.delete("sort");
          const qs = params.toString();
          router.push(qs ? `/referrals?${qs}` : "/referrals");
        }}
      >
        <option value="desc">Newest</option>
        <option value="asc">Oldest</option>
      </select>
    </label>
  );
}
