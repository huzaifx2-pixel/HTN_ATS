"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateBrandKitAction } from "@/app/marketing-actions";

export function BrandKitForm({
  brand,
}: {
  brand: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    footerHtml: string | null;
    signatureHtml: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await updateBrandKitAction({
            logoUrl: String(fd.get("logoUrl") ?? ""),
            primaryColor: String(fd.get("primaryColor") ?? ""),
            secondaryColor: String(fd.get("secondaryColor") ?? ""),
            fontFamily: String(fd.get("fontFamily") ?? ""),
            footerHtml: String(fd.get("footerHtml") ?? ""),
            signatureHtml: String(fd.get("signatureHtml") ?? ""),
          });
        });
      }}
    >
      <div>
        <label className="text-sm font-medium">Logo URL</label>
        <input name="logoUrl" defaultValue={brand.logoUrl ?? ""} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Primary color</label>
          <input name="primaryColor" type="color" defaultValue={brand.primaryColor} className="mt-1 h-10 w-full rounded-lg border border-input" />
        </div>
        <div>
          <label className="text-sm font-medium">Secondary color</label>
          <input name="secondaryColor" type="color" defaultValue={brand.secondaryColor} className="mt-1 h-10 w-full rounded-lg border border-input" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Font family</label>
        <input name="fontFamily" defaultValue={brand.fontFamily} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Footer HTML</label>
        <textarea name="footerHtml" defaultValue={brand.footerHtml ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Signature block</label>
        <textarea name="signatureHtml" defaultValue={brand.signatureHtml ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save brand kit"}</Button>
    </form>
  );
}
