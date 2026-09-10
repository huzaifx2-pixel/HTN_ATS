"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JobShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url, title: "Job referral link" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  return (
    <Button size="sm" variant="outline" type="button" onClick={onShare}>
      <Share2 className="h-3.5 w-3.5" />
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
