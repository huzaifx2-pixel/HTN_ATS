"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { deleteJobTemplateAction } from "@/app/actions";

export function JobTemplatesList({
  templates,
}: {
  templates: Array<{
    id: string;
    name: string;
    title: string;
    updatedAt: string;
  }>;
}) {
  const router = useRouter();

  const remove = async (templateId: string) => {
    if (!confirm("Delete this template?")) return;
    await deleteJobTemplateAction(templateId);
    router.refresh();
  };

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No templates yet. Open any job and use &quot;Save as template&quot; on the overview tab.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {templates.map((template) => (
        <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div>
            <p className="font-medium">{template.name}</p>
            <p className="text-xs text-muted-foreground">{template.title}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/jobs/create?templateId=${template.id}`}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white"
            >
              Use template
            </Link>
            <button
              type="button"
              onClick={() => remove(template.id)}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
