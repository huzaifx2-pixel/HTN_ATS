"use client";

import { useState } from "react";
import { AudienceBuilder } from "@/components/marketing/audience-builder";
import { AudienceImport } from "@/components/marketing/audience-import";
import { UnsubscribedListPanel } from "@/components/marketing/unsubscribed-list-client";
import { cn } from "@/lib/utils";

type UnsubscribedEntry = {
  id: string;
  email: string;
  createdAt: string;
  candidate?: { id: string; name: string } | null;
};

export function AudienceTabs({ unsubscribed }: { unsubscribed: UnsubscribedEntry[] }) {
  const [tab, setTab] = useState<"filters" | "import" | "unsubscribed">("filters");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("filters")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            tab === "filters" ? "bg-brand-700 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          From ATS filters
        </button>
        <button
          type="button"
          onClick={() => setTab("import")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            tab === "import" ? "bg-brand-700 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          Import CSV / Excel
        </button>
        <button
          type="button"
          onClick={() => setTab("unsubscribed")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            tab === "unsubscribed" ? "bg-brand-700 text-white" : "bg-muted text-muted-foreground",
          )}
        >
          Unsubscribed
        </button>
      </div>

      {tab === "filters" && <AudienceBuilder />}
      {tab === "import" && <AudienceImport />}
      {tab === "unsubscribed" && <UnsubscribedListPanel entries={unsubscribed} />}
    </div>
  );
}
