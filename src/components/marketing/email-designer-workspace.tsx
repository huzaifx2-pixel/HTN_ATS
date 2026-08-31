"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveMarketingTemplateAction } from "@/app/marketing-actions";
import { EmailDesigner, type EmailDesignerBrand } from "@/components/marketing/email-designer";
import { Button } from "@/components/ui/button";
import type { EmailBlock } from "@/lib/marketing/types";

type TemplateOption = {
  id: string;
  name: string;
  subject: string;
  designJson: EmailBlock[];
  isSystem: boolean;
};

export function EmailDesignerWorkspace({
  brand,
  templates,
  initialTemplate,
}: {
  brand?: EmailDesignerBrand;
  templates: TemplateOption[];
  initialTemplate?: TemplateOption | null;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialTemplate?.designJson ?? []);
  const [htmlContent, setHtmlContent] = useState("");
  const [subject, setSubject] = useState(initialTemplate?.subject ?? "");
  const [templateName, setTemplateName] = useState(initialTemplate?.name ?? "");
  const [templateId, setTemplateId] = useState<string | undefined>(
    initialTemplate && !initialTemplate.isSystem ? initialTemplate.id : undefined,
  );
  const [loadId, setLoadId] = useState(initialTemplate?.id ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onDesignChange = useCallback((nextBlocks: EmailBlock[], html: string) => {
    setBlocks(nextBlocks);
    setHtmlContent(html);
  }, []);

  const loadTemplate = (id: string) => {
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setLoadId(id);
    setSubject(tpl.subject);
    setTemplateName(tpl.isSystem ? `${tpl.name} (Copy)` : tpl.name);
    setTemplateId(tpl.isSystem ? undefined : tpl.id);
    setBlocks(tpl.designJson);
    setStatus(`Loaded "${tpl.name}". ${tpl.isSystem ? "Saving will create a new custom copy." : "Click Save to update this template."}`);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      setStatus("Enter a template name before saving.");
      return;
    }
    if (!subject.trim()) {
      setStatus("Enter an email subject line before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveMarketingTemplateAction({
          name: templateName.trim(),
          subject: subject.trim(),
          designJson: blocks,
          htmlContent,
          templateId,
        });
        setTemplateId(result.templateId);
        setLoadId(result.templateId);
        setStatus(`Saved template "${result.name}".`);
        router.replace(`/marketing/designer?template=${result.templateId}`);
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to save template");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="min-w-[180px] flex-1">
          <label className="text-xs font-medium text-muted-foreground">Template name</label>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="My job blast template"
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="text-xs font-medium text-muted-foreground">Load saved template</label>
          <select
            value={loadId}
            onChange={(e) => loadTemplate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          >
            <option value="">Choose a template…</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
                {tpl.isSystem ? " (built-in)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={saveTemplate} disabled={pending}>
          <Save className="mr-1 h-4 w-4" />
          {pending ? "Saving…" : templateId ? "Save changes" : "Save template"}
        </Button>
        {status && <p className="w-full text-xs text-muted-foreground">{status}</p>}
      </div>

      <EmailDesigner
        key={loadId || "new"}
        initialBlocks={blocks.length ? blocks : undefined}
        brand={brand}
        subject={subject}
        onSubjectChange={setSubject}
        onChange={onDesignChange}
        showTestEmail
      />
    </div>
  );
}
