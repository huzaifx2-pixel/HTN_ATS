"use client";

import Link from "next/link";
import { useTransition } from "react";
import { mergeCandidatesAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DuplicateCandidatesPanel({
  candidateId,
  duplicates,
}: {
  candidateId: string;
  duplicates: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    linkedIn: string | null;
    currentRole: string | null;
    createdAt: Date;
  }>;
}) {
  const [pending, startTransition] = useTransition();

  if (duplicates.length === 0) {
    return <p className="text-sm text-muted-foreground">No potential duplicates found.</p>;
  }

  return (
    <div className="space-y-2">
      {duplicates.map((dup) => (
        <div key={dup.id} className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Link href={`/candidates/${dup.id}`} className="text-sm font-medium text-brand-700 hover:underline">
              {dup.firstName} {dup.lastName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {[dup.email, dup.phone, dup.linkedIn, dup.currentRole].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!window.confirm("Merge this duplicate into the current profile?")) return;
                await mergeCandidatesAction(candidateId, dup.id);
                window.location.reload();
              })
            }
          >
            Merge into this profile
          </Button>
        </div>
      ))}
    </div>
  );
}
