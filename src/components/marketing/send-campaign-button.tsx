"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendCampaignAction } from "@/app/marketing-actions";

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await sendCampaignAction(campaignId);
          router.refresh();
        })
      }
    >
      {pending ? "Sending..." : "Send Campaign"}
    </Button>
  );
}
