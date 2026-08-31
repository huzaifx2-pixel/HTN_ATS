"use client";

import { Input, Label } from "@/components/ui/input";

export function ApplyLinkField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>Apply link / button URL</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="https://…"
        className="mt-1"
      />
      <p className="text-xs text-muted-foreground mt-1">
        This is the URL behind the Apply button in this email. You can change it for this send.
        Click the Apply button in the message to edit its text or URL.
      </p>
    </div>
  );
}
