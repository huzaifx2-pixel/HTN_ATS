"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { previewBooleanSearchAction } from "@/app/actions";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type BooleanSearchEditorProps = {
  id?: string;
  name?: string;
  defaultValue?: string | null;
  /** When set, Regenerate loads latest saved job title/description from the server. */
  jobId?: string;
  /** IDs of form fields to read for client-side regenerate on create/edit. */
  titleInputId?: string;
  descriptionInputId?: string;
  skillsInputId?: string;
  preferredSkillsInputId?: string;
  certificationsInputId?: string;
  rows?: number;
  className?: string;
};

function readInputValue(id?: string): string {
  if (!id || typeof document === "undefined") return "";
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value?.trim() ?? "";
}

function parseCommaList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function BooleanSearchEditor({
  id = "booleanSearch",
  name = "booleanSearch",
  defaultValue = "",
  jobId,
  titleInputId = "title",
  descriptionInputId = "description",
  skillsInputId,
  preferredSkillsInputId,
  certificationsInputId,
  rows = 10,
  className,
}: BooleanSearchEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchedRef = useRef<HTMLInputElement>(null);
  const savedQuery = (defaultValue ?? "").trim();
  const [value, setValue] = useState(defaultValue ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  const markTouched = () => {
    if (touchedRef.current) touchedRef.current.value = "true";
  };

  const loadGenerated = useCallback(async () => {
    return previewBooleanSearchAction({
      jobId,
      title: readInputValue(titleInputId),
      description: readInputValue(descriptionInputId),
      skills: skillsInputId ? parseCommaList(readInputValue(skillsInputId)) : undefined,
      preferredSkills: preferredSkillsInputId
        ? parseCommaList(readInputValue(preferredSkillsInputId))
        : undefined,
      certifications: certificationsInputId
        ? parseCommaList(readInputValue(certificationsInputId))
        : undefined,
    });
  }, [
    certificationsInputId,
    descriptionInputId,
    jobId,
    preferredSkillsInputId,
    skillsInputId,
    titleInputId,
  ]);

  const applyGenerated = useCallback((booleanSearch: string, markUntouched: boolean) => {
    setValue(booleanSearch);
    if (textareaRef.current) textareaRef.current.value = booleanSearch;
    if (markUntouched && touchedRef.current) touchedRef.current.value = "false";
  }, []);

  const regenerate = useCallback(() => {
    if (!window.confirm("Regenerating will replace the current Boolean.\nContinue?")) return;

    startTransition(async () => {
      const result = await loadGenerated();
      applyGenerated(result.booleanSearch, true);
    });
  }, [applyGenerated, loadGenerated]);

  useEffect(() => {
    const ids = [titleInputId, descriptionInputId, skillsInputId, preferredSkillsInputId, certificationsInputId]
      .filter((fieldId): fieldId is string => Boolean(fieldId));
    const elements = ids
      .map((fieldId) => document.getElementById(fieldId))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFieldChange = () => {
      if (touchedRef.current?.value === "true") return;
      const title = readInputValue(titleInputId);
      if (!title) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        startTransition(async () => {
          if (touchedRef.current?.value === "true") return;
          const result = await loadGenerated();
          if (touchedRef.current?.value === "true") return;
          applyGenerated(result.booleanSearch, false);
        });
      }, 500);
    };

    for (const el of elements) {
      el.addEventListener("input", onFieldChange);
      el.addEventListener("change", onFieldChange);
    }
    if (!(defaultValue ?? "").trim() && readInputValue(titleInputId)) {
      onFieldChange();
    }

    return () => {
      clearTimeout(timer);
      for (const el of elements) {
        el.removeEventListener("input", onFieldChange);
        el.removeEventListener("change", onFieldChange);
      }
    };
  }, [
    applyGenerated,
    certificationsInputId,
    defaultValue,
    descriptionInputId,
    loadGenerated,
    preferredSkillsInputId,
    skillsInputId,
    titleInputId,
  ]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <Label htmlFor={id}>Boolean Search</Label>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={regenerate}>
          {pending ? "Generating…" : "Regenerate Boolean"}
        </Button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          markTouched();
        }}
        placeholder="Generated automatically from the job title and description."
        className="mt-1 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-mono leading-relaxed"
      />
      <input
        ref={touchedRef}
        type="hidden"
        name="booleanSearchTouched"
        defaultValue={savedQuery ? "true" : "false"}
      />
      <input type="hidden" name="booleanSearchForceRegenerate" defaultValue="false" id={`${id}-forceRegenerate`} />
      <p className="mt-1 text-xs text-muted-foreground">
        Auto-generated from the job title and description as you type. Edit freely — your changes are saved as entered.
      </p>
    </div>
  );
}
