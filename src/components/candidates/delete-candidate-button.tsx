"use client";

import { useState, useTransition } from "react";
import { softDeleteCandidateAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Delete Candidate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete candidate?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{candidateName}</span> will be moved to
            the recycle bin. You can restore them later from Candidates → Recycle Bin.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await softDeleteCandidateAction(candidateId);
                });
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
