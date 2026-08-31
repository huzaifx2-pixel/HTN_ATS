"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReferralLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="pt-3 mt-3 border-t border-border/60">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Apply Link
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs break-all">{url}</code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Share this apply link so candidates can view the role and apply.
      </p>
    </div>
  );
}
