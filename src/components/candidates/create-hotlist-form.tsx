"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createHotlistAction } from "@/app/actions";

export function CreateHotlistForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
        const description = (form.elements.namedItem("description") as HTMLInputElement).value.trim();
        if (!name) return;
        startTransition(async () => {
          const hotlist = await createHotlistAction(name, description || undefined);
          router.push(`/candidates/hotlists/${hotlist.id}`);
          router.refresh();
        });
      }}
    >
      <div>
        <Label htmlFor="hotlist-name">Hotlist name</Label>
        <Input id="hotlist-name" name="name" required placeholder="Top Java Developers" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="hotlist-description">Description</Label>
        <Input id="hotlist-description" name="description" placeholder="Optional" className="mt-1" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creating..." : "Create hotlist"}
      </Button>
    </form>
  );
}
