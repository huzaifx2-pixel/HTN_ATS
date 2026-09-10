"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMicro1ReferralAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ReferralDeleteButton({
  referralId,
  name,
  className,
}: {
  referralId: string;
  name: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        title="Remove candidate"
        aria-label={`Remove ${name}`}
        disabled={pending}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50",
          className,
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base">Remove {name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes them from referral tracking permanently. It cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await deleteMicro1ReferralAction(referralId);
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
