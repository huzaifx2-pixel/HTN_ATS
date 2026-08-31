"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmailDesigner } from "@/components/marketing/email-designer";
import { createCampaignAction, sendCampaignAction } from "@/app/marketing-actions";
import type { EmailBlock, MarketingCampaignType } from "@/lib/marketing/types";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/marketing/types";
import type { EmailDesignerBrand } from "@/components/marketing/email-designer";

type AudienceOption = { id: string; name: string; estimatedCount: number };

export function CampaignWizard({
  audiences,
  brand,
  initialBlocks,
  initialSubject,
}: {
  audiences: AudienceOption[];
  brand?: EmailDesignerBrand;
  initialBlocks?: EmailBlock[];
  initialSubject?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<MarketingCampaignType>("JOB_BLAST");
  const [audienceId, setAudienceId] = useState(audiences[0]?.id ?? "");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [designJson, setDesignJson] = useState<EmailBlock[]>(initialBlocks ?? []);
  const [htmlContent, setHtmlContent] = useState("");
  const [scheduleType, setScheduleType] = useState<"IMMEDIATE" | "SCHEDULED">("IMMEDIATE");
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreviewCount = () => {
    const audience = audiences.find((a) => a.id === audienceId);
    if (audience) setPreviewCount(audience.estimatedCount);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createCampaignAction({
          name,
          internalNotes: notes || undefined,
          type,
          audienceId: audienceId || undefined,
          subject,
          designJson,
          htmlContent,
          scheduleType,
          scheduledAt: scheduledAt || undefined,
        });

        if (result.sendNow && result.campaignId) {
          await sendCampaignAction(result.campaignId);
        }
        router.push(`/marketing/campaigns/${result.campaignId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create campaign");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`rounded-full px-3 py-1 ${step === n ? "bg-brand-700 text-white" : "bg-muted text-muted-foreground"}`}
          >
            Step {n}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="text-sm font-medium">Campaign name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Campaign type</label>
            <select value={type} onChange={(e) => setType(e.target.value as MarketingCampaignType)} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm">
              {Object.entries(CAMPAIGN_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Internal notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
          </div>
          <Button type="button" onClick={() => setStep(2)} disabled={!name.trim()}>Next: Audience</Button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="text-sm font-medium">Saved audience</label>
            <select value={audienceId} onChange={(e) => setAudienceId(e.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm">
              {audiences.length === 0 && <option value="">No audiences — create one first</option>}
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.estimatedCount} recipients)</option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={loadPreviewCount}>Refresh reach estimate</Button>
          {previewCount !== null && <p className="text-sm text-muted-foreground">Estimated reach: {previewCount} recipients</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" onClick={() => setStep(3)} disabled={!audienceId}>Next: Design</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <EmailDesigner
            brand={brand}
            initialBlocks={initialBlocks}
            subject={subject}
            onSubjectChange={setSubject}
            onChange={(blocks, html) => {
              setDesignJson(blocks);
              setHtmlContent(html);
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button type="button" onClick={() => setStep(4)} disabled={!subject.trim()}>Next: Schedule</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="text-sm font-medium">When to send</label>
            <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as "IMMEDIATE" | "SCHEDULED")} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm">
              <option value="IMMEDIATE">Send now</option>
              <option value="SCHEDULED">Schedule for later</option>
            </select>
          </div>
          {scheduleType === "SCHEDULED" && (
            <div>
              <label className="text-sm font-medium">Scheduled date & time</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Creating..." : scheduleType === "IMMEDIATE" ? "Create & Send" : "Schedule Campaign"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
