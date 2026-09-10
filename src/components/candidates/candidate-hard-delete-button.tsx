"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { hardDeleteCandidateAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CandidateHardDeleteButton({ candidateId }: { candidateId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        title="Delete permanently"
        disabled={pending}
        className={cn(
          "inline-flex h-8 flex-col items-center justify-center gap-0 rounded px-2 text-[10px] font-medium leading-tight",
          pending ? "pointer-events-none text-[#9aa8b8]" : "text-red-700 hover:bg-white",
        )}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base">Delete this candidate?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the candidate. It cannot be undone and will not go to the recycle bin.
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
                  await hardDeleteCandidateAction(candidateId);
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
