"use client";

import type { MouseEvent, PointerEvent } from "react";
import { MERGE_FIELD_HELP, HYPERLINK_MERGE_FIELDS, applyLinkHtml } from "@/lib/constants/email";
import { cn } from "@/lib/utils";

type MergeFieldsHelpProps = {
  className?: string;
  onInsert?: (field: string) => void;
  onInsertHtml?: (html: string) => void;
};

export function MergeFieldsHelp({ className, onInsert, onInsertHtml }: MergeFieldsHelpProps) {
  function insert(field: string) {
    if (onInsertHtml && HYPERLINK_MERGE_FIELDS.has(field as "{{ApplyLink}}" | "{{ReferralLink}}")) {
      const selected = window.getSelection()?.toString().trim();
      onInsertHtml(
        applyLinkHtml(field as "{{ApplyLink}}" | "{{ReferralLink}}", selected || "Apply here"),
      );
      return;
    }
    onInsert?.(field);
  }

  function handleActivate(event: MouseEvent | PointerEvent, field: string) {
    event.preventDefault();
    insert(field);
  }

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Available merge fields
        {onInsert ? (
          <span className="font-normal text-muted-foreground/80"> — press a tag to insert it into the body</span>
        ) : null}
      </p>
      <dl className="space-y-1.5 text-xs">
        {MERGE_FIELD_HELP.map(({ field, description }) => (
          <div
            key={field}
            className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 items-start"
          >
            <dt className="shrink-0">
              {onInsert ? (
                <button
                  type="button"
                  className={cn(
                    "font-mono text-foreground rounded-md border border-border/60 bg-background px-2 py-0.5",
                    "hover:bg-muted hover:border-border transition-colors cursor-pointer"
                  )}
                  onMouseDown={(event) => handleActivate(event, field)}
                >
                  {field}
                </button>
              ) : (
                <span className="font-mono text-foreground">{field}</span>
              )}
            </dt>
            <dd className="text-muted-foreground pt-0.5">{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
