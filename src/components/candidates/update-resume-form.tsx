"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { uploadCandidateResumeAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function UpdateResumeForm({
  candidateId,
  hasResume,
}: {
  candidateId: string;
  hasResume: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.rtf,.txt,.png,.jpg,.jpeg"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;

          const formData = new FormData();
          formData.set("file", file);
          setError(null);

          startTransition(async () => {
            const result = await uploadCandidateResumeAction(candidateId, formData);
            if (result) {
              setError(result);
              return;
            }
            toast.success(hasResume ? "Resume updated" : "Resume added");
            router.refresh();
          });
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {pending ? "Parsing…" : hasResume ? "Update resume" : "Add resume"}
      </Button>
      {error ? <p className="max-w-[220px] text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
