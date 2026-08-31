"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { approveCampaignAction, rejectCampaignAction } from "@/app/marketing-actions";
import { Button } from "@/components/ui/button";

type PendingCampaign = {
  id: string;
  name: string;
  subject: string | null;
  updatedAt: string;
  audience: { name: string; estimatedCount: number } | null;
};

export function MarketingApprovalPanel({ campaigns }: { campaigns: PendingCampaign[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (campaigns.length === 0) return null;

  const run = (campaignId: string, action: "approve" | "reject") => {
    startTransition(async () => {
      if (action === "approve") await approveCampaignAction(campaignId);
      else await rejectCampaignAction(campaignId);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <h3 className="text-sm font-semibold">Pending approval ({campaigns.length})</h3>
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm">
          <div>
            <p className="font-medium">{campaign.name}</p>
            <p className="text-xs text-muted-foreground">
              {campaign.subject ?? "(No subject)"}
              {campaign.audience ? ` · ${campaign.audience.name} (${campaign.audience.estimatedCount})` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => run(campaign.id, "approve")}>
              Approve & send
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(campaign.id, "reject")}>
              Return to draft
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
