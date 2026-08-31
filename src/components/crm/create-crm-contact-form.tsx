"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCrmContactAction } from "@/app/actions";

export function CreateCrmContactForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          await createCrmContactAction({
            firstName: String(fd.get("firstName")),
            lastName: String(fd.get("lastName")),
            email: String(fd.get("email") || "") || undefined,
            title: String(fd.get("title") || "") || undefined,
            clientId: String(fd.get("clientId") || "") || undefined,
          });
          router.refresh();
          form.reset();
        });
      }}
    >
      <div><Label>First name</Label><Input name="firstName" required className="mt-1" /></div>
      <div><Label>Last name</Label><Input name="lastName" required className="mt-1" /></div>
      <div><Label>Email</Label><Input name="email" type="email" className="mt-1" /></div>
      <div><Label>Title</Label><Input name="title" className="mt-1" /></div>
      <div>
        <Label>Company</Label>
        <select name="clientId" className="mt-1 h-9 w-full rounded-md border px-2 text-sm">
          <option value="">Unassigned</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>Add contact</Button>
    </form>
  );
}
