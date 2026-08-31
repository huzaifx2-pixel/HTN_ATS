"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { updateProfileNameAction } from "@/app/(dashboard)/settings/profile/actions";

export function ProfileNameForm({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [error, saveName, pending] = useActionState(updateProfileNameAction, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, error, router]);

  return (
    <form action={saveName} className="space-y-3" key={currentName}>
      <div>
        <Label htmlFor="profile-name">Full name</Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={currentName}
          required
          className="mt-1"
          placeholder="Your name"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
