"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  recalculateStorageUsageAction,
  updateStorageLimitAction,
} from "@/app/(dashboard)/settings/actions";
import { formatBytes } from "@/lib/utils";

const PRESET_LIMITS_GB = [10, 50, 100, 200, 500];

export function StorageLimitForm({
  storageUsedBytes,
  storageLimitBytes,
  actualDocumentBytes,
  documentCount,
  usageDriftBytes,
  canManage,
}: {
  storageUsedBytes: number;
  storageLimitBytes: number;
  actualDocumentBytes: number;
  documentCount: number;
  usageDriftBytes: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, saveLimit, pending] = useActionState(updateStorageLimitAction, undefined);
  const [recalcPending, startRecalc] = useTransition();
  const [recalcError, setRecalcError] = useState<string | undefined>();
  const wasPending = useRef(false);

  const usagePct =
    storageLimitBytes > 0 ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100)) : 0;
  const limitGb = Math.round(storageLimitBytes / (1024 * 1024 * 1024));

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, error, router]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Storage used</span>
          <span className="font-medium">
            {formatBytes(storageUsedBytes)} / {formatBytes(storageLimitBytes)} ({usagePct}%)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct >= 90 ? "bg-red-500" : usagePct >= 70 ? "bg-amber-500" : "bg-brand-700"
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Documents on disk:</span>{" "}
          <span className="font-medium">{formatBytes(actualDocumentBytes)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">File count:</span>{" "}
          <span className="font-medium">{documentCount.toLocaleString()}</span>
        </div>
      </div>

      {Math.abs(usageDriftBytes) > 1024 * 1024 && (
        <p className="text-xs text-amber-700">
          Usage counter differs from document total by {formatBytes(Math.abs(usageDriftBytes))}.
          {canManage && " Use Recalculate to sync."}
        </p>
      )}

      {canManage ? (
        <>
          <form action={saveLimit} className="space-y-3">
            <div>
              <Label htmlFor="limit-gb">Storage limit (GB)</Label>
              <Input
                id="limit-gb"
                name="limitGb"
                type="number"
                min={1}
                max={2048}
                step={1}
                defaultValue={limitGb}
                required
                className="mt-1 max-w-xs"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save storage limit"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {PRESET_LIMITS_GB.map((gb) => (
              <form key={gb} action={saveLimit}>
                <input type="hidden" name="limitGb" value={gb} />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                  {gb} GB
                </Button>
              </form>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={recalcPending || pending}
            onClick={() => {
              setRecalcError(undefined);
              startRecalc(async () => {
                const err = await recalculateStorageUsageAction();
                if (err) {
                  setRecalcError(err);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {recalcPending ? "Recalculating…" : "Recalculate usage from documents"}
          </Button>
          {recalcError && <p className="text-sm text-red-600">{recalcError}</p>}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only organization admins can change the storage limit.
        </p>
      )}
    </div>
  );
}
