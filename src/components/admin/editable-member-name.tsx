"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserNameAction } from "@/app/(dashboard)/admin/users/actions";

export function EditableMemberName({
  memberId,
  name,
  canEdit,
}: {
  memberId: string;
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setDisplayName(name);
    if (!editing) {
      setDraft(name);
    }
  }, [name, editing]);

  if (!canEdit) {
    return <span className="truncate text-sm font-medium">{displayName}</span>;
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate text-sm font-medium">{displayName}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          disabled={pending}
          onClick={() => {
            setDraft(displayName);
            setEditing(true);
          }}
          aria-label="Edit name"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="h-8 text-sm"
        disabled={pending}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(displayName);
            setEditing(false);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const error = await updateUserNameAction(memberId, draft);
            if (error) {
              window.alert(error);
              return;
            }
            setDisplayName(draft.trim());
            setEditing(false);
            router.refresh();
          });
        }}
      >
        <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={pending}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={pending}
        onClick={() => {
          setDraft(displayName);
          setEditing(false);
        }}
        aria-label="Cancel editing"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
