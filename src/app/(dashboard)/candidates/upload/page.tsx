"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UploadResultItem = {
  candidate?: { firstName: string; lastName: string; id?: string };
  duplicate?: boolean;
  error?: string;
  fileName?: string;
};

type UploadFileStatus = "queued" | "uploading" | "parsing" | "done" | "error" | "cancelled";

type UploadFileState = {
  id: string;
  fileName: string;
  status: UploadFileStatus;
  progress: number;
  result?: UploadResultItem;
};

const UPLOAD_TIMEOUT_MS = 120_000;

const UPLOAD_TYPES = [
  { title: "Single Upload", type: "single", accept: ".pdf,.doc,.docx,.rtf,.txt,.png,.jpg,.jpeg", multiple: false, inputName: "file" as const },
  { title: "Bulk Upload", type: "bulk", accept: ".pdf,.doc,.docx,.rtf,.txt,.png,.jpg,.jpeg", multiple: true, inputName: "files" as const },
  { title: "ZIP Upload", type: "zip", accept: ".zip", multiple: false, inputName: "file" as const },
];

function parseUploadResponse(payload: unknown, fileName: string): UploadResultItem | UploadResultItem[] {
  const data = payload as {
    error?: string;
    results?: Array<{
      error?: string;
      fileName?: string;
      duplicate?: boolean;
      candidate?: { firstName: string; lastName: string; id: string };
    }>;
    candidate?: { firstName: string; lastName: string; id: string };
    duplicate?: boolean;
  };

  if (data.error) {
    return { error: data.error, fileName };
  }

  if (Array.isArray(data.results)) {
    return data.results.map((result) =>
      result.error
        ? { error: result.error, fileName: result.fileName ?? fileName }
        : {
            fileName: result.fileName ?? fileName,
            duplicate: result.duplicate,
            candidate: result.candidate
              ? {
                  firstName: result.candidate.firstName,
                  lastName: result.candidate.lastName,
                  id: result.candidate.id,
                }
              : undefined,
          },
    );
  }

  if (data.candidate) {
    return {
      fileName,
      duplicate: data.duplicate,
      candidate: {
        firstName: data.candidate.firstName,
        lastName: data.candidate.lastName,
        id: data.candidate.id,
      },
    };
  }

  return { error: "Unexpected upload response.", fileName };
}

function uploadFileWithProgress(
  file: File,
  type: "single" | "zip",
  onProgress: (progress: number, status: UploadFileStatus) => void,
  options?: { signal?: AbortSignal; itemId?: string },
): Promise<UploadResultItem | UploadResultItem[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const formData = new FormData();
    formData.set("type", type);
    formData.set("file", file);

    const settle = (handler: () => void) => {
      if (settled) return;
      settled = true;
      handler();
    };

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const uploadPct = Math.round((event.loaded / event.total) * 75);
      onProgress(uploadPct, "uploading");
    });

    xhr.upload.addEventListener("loadend", () => {
      onProgress(80, "parsing");
    });

    xhr.addEventListener("load", () => {
      settle(() => {
        try {
          const payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          if (xhr.status >= 400) {
            const result = parseUploadResponse(payload, file.name);
            onProgress(100, "error");
            resolve(Array.isArray(result) ? result : result);
            return;
          }
          const result = parseUploadResponse(payload, file.name);
          if (Array.isArray(result)) {
            onProgress(100, "done");
            resolve(result);
            return;
          }
          onProgress(100, result.error ? "error" : "done");
          resolve(result);
        } catch {
          onProgress(100, "error");
          resolve({ error: "Invalid server response.", fileName: file.name });
        }
      });
    });

    xhr.addEventListener("error", () => {
      settle(() => {
        onProgress(100, "error");
        reject(new Error("Network error during upload."));
      });
    });

    xhr.addEventListener("timeout", () => {
      settle(() => {
        onProgress(100, "error");
        reject(new Error("Upload timed out while parsing. Remove and retry this file."));
      });
    });

    xhr.addEventListener("abort", () => {
      settle(() => {
        onProgress(100, "cancelled");
        reject(new Error("Upload cancelled."));
      });
    });

    if (options?.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener(
        "abort",
        () => {
          xhr.abort();
          settle(() => {
            onProgress(100, "cancelled");
            reject(new Error("Upload cancelled."));
          });
        },
        { once: true },
      );
    }

    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.send(formData);
  });
}

function statusLabel(status: UploadFileStatus) {
  switch (status) {
    case "queued":
      return "Waiting";
    case "uploading":
      return "Uploading";
    case "parsing":
      return "Parsing";
    case "done":
      return "Complete";
    case "error":
      return "Failed";
    case "cancelled":
      return "Removed";
  }
}

function UploadProgressBar({ progress, status }: { progress: number; status: UploadFileStatus }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          status === "error"
            ? "bg-destructive"
            : status === "cancelled"
              ? "bg-muted-foreground/50"
              : status === "done"
                ? "bg-green-600"
                : "bg-brand-700",
        )}
        style={{ width: `${Math.max(status === "queued" ? 0 : 4, progress)}%` }}
      />
    </div>
  );
}

function UploadProgressList({
  items,
  title,
  onRemove,
}: {
  items: UploadFileState[];
  title: string;
  onRemove: (id: string) => void;
}) {
  const completed = items.filter(
    (item) => item.status === "done" || item.status === "error" || item.status === "cancelled",
  ).length;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {completed} / {items.length} complete
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[420px] overflow-y-auto">
        {items.map((item) => {
          const canRemove = item.status === "queued" || item.status === "uploading" || item.status === "parsing";

          return (
            <div key={item.id} className="rounded-lg border border-border/80 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">{statusLabel(item.status)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs tabular-nums text-muted-foreground">{item.progress}%</span>
                  {canRemove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${item.fileName} from queue`}
                      onClick={() => onRemove(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <UploadProgressBar progress={item.progress} status={item.status} />
              {item.result?.error && item.status !== "cancelled" && (
                <p className="text-xs text-destructive">{item.result.error}</p>
              )}
              {item.status === "cancelled" && (
                <p className="text-xs text-muted-foreground">Removed from queue</p>
              )}
              {item.result?.candidate && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  {item.result.duplicate ? "Duplicate: " : "Added: "}
                  {item.result.candidate.firstName} {item.result.candidate.lastName}
                  {item.result.candidate.id && !item.result.duplicate && (
                    <Link
                      href={`/candidates/${item.result.candidate.id}`}
                      className="ml-2 text-brand-700 hover:underline"
                    >
                      View →
                    </Link>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function UploadForm({
  title,
  accept,
  multiple,
  pending,
  onUpload,
}: {
  title: string;
  accept: string;
  multiple: boolean;
  pending: boolean;
  onUpload: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={pending}
            className="cursor-pointer py-1.5 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-900"
          />
          <Button
            type="button"
            disabled={pending}
            size="sm"
            className="w-full"
            onClick={() => {
              const files = Array.from(inputRef.current?.files ?? []);
              onUpload(files);
            }}
          >
            {pending ? "Uploading..." : "Upload & Parse"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const UPLOAD_PROGRESS_KEY = "htn-upload-progress";

export default function UploadCandidatesPage() {
  const [uploadItems, setUploadItems] = useState<UploadFileState[]>([]);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const cancelledRef = useRef(new Set<string>());
  const abortControllersRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UPLOAD_PROGRESS_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as UploadFileState[];
      setUploadItems(
        stored.map((item) =>
          item.status === "queued" || item.status === "uploading" || item.status === "parsing"
            ? {
                ...item,
                status: "error" as const,
                progress: 100,
                result: {
                  error: "Upload interrupted by page reload. Select the files and click Upload & Parse again.",
                  fileName: item.fileName,
                },
              }
            : item,
        ),
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(uploadItems));
    } catch {
      /* ignore */
    }
  }, [uploadItems]);

  function updateItem(id: string, patch: Partial<UploadFileState>) {
    setUploadItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeFromQueue(id: string) {
    cancelledRef.current.add(id);

    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }

    setUploadItems((current) => current.filter((item) => item.id !== id));
  }

  function handleUpload(type: string) {
    return async (files: File[]) => {
      setPendingType(type);
      cancelledRef.current.clear();
      abortControllersRef.current.clear();

      if (!files.length) {
        setUploadItems([
          {
            id: "error",
            fileName: "Upload",
            status: "error",
            progress: 100,
            result: { error: "No file provided." },
          },
        ]);
        setPendingType(null);
        return;
      }

      if (type === "bulk") {
        const initial: UploadFileState[] = files.map((file, index) => ({
          id: `${file.name}-${index}`,
          fileName: file.name,
          status: "queued",
          progress: 0,
        }));
        setUploadItems(initial);

        for (const item of initial) {
          if (cancelledRef.current.has(item.id)) {
            continue;
          }

          const file = files.find((entry, index) => `${entry.name}-${index}` === item.id);
          if (!file) continue;

          const controller = new AbortController();
          abortControllersRef.current.set(item.id, controller);

          updateItem(item.id, { status: "uploading", progress: 5 });

          try {
            const result = await uploadFileWithProgress(
              file,
              "single",
              (progress, status) => {
                if (!cancelledRef.current.has(item.id)) {
                  updateItem(item.id, { progress, status });
                }
              },
              { signal: controller.signal, itemId: item.id },
            );

            abortControllersRef.current.delete(item.id);

            if (cancelledRef.current.has(item.id)) continue;

            if (Array.isArray(result)) {
              updateItem(item.id, {
                progress: 100,
                status: "error",
                result: { error: "Unexpected upload response.", fileName: file.name },
              });
              continue;
            }
            updateItem(item.id, {
              progress: 100,
              status: result.error ? "error" : "done",
              result: { ...result, fileName: file.name },
            });
          } catch (error) {
            abortControllersRef.current.delete(item.id);
            if (cancelledRef.current.has(item.id)) continue;

            updateItem(item.id, {
              progress: 100,
              status: "error",
              result: {
                error: error instanceof Error ? error.message : "Upload failed.",
                fileName: file.name,
              },
            });
          }
        }
      } else {
        const file = files[0];
        const itemId = file.name;
        const controller = new AbortController();
        abortControllersRef.current.set(itemId, controller);

        setUploadItems([
          {
            id: itemId,
            fileName: file.name,
            status: "uploading",
            progress: 5,
          },
        ]);

        try {
          const uploadType = type === "zip" ? "zip" : "single";
          const result = await uploadFileWithProgress(
            file,
            uploadType,
            (progress, status) => updateItem(itemId, { progress, status }),
            { signal: controller.signal, itemId },
          );

          if (Array.isArray(result)) {
            setUploadItems(
              result.map((entry, index) => ({
                id: `${entry.fileName ?? file.name}-${index}`,
                fileName: entry.fileName ?? `Resume ${index + 1}`,
                status: entry.error ? ("error" as const) : ("done" as const),
                progress: 100,
                result: entry,
              })),
            );
          } else {
            updateItem(itemId, {
              progress: 100,
              status: result.error ? "error" : "done",
              result: { ...result, fileName: file.name },
            });
          }
        } catch (error) {
          if (!cancelledRef.current.has(itemId)) {
            updateItem(itemId, {
              progress: 100,
              status: "error",
              result: {
                error: error instanceof Error ? error.message : "Upload failed.",
                fileName: file.name,
              },
            });
          }
        }
      }

      setPendingType(null);
    };
  }

  return (
    <div>
      <PageHeader title="Bulk Upload" description="Upload single, multiple, or ZIP resume files (max 10MB each)" />
      {uploadItems.length > 0 && (
        <UploadProgressList
          items={uploadItems}
          title={pendingType === "bulk" || uploadItems.length > 1 ? "Upload progress" : "Upload result"}
          onRemove={removeFromQueue}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {UPLOAD_TYPES.map((uploadType) => (
          <UploadForm
            key={uploadType.type}
            title={uploadType.title}
            accept={uploadType.accept}
            multiple={uploadType.multiple}
            pending={pendingType === uploadType.type}
            onUpload={handleUpload(uploadType.type)}
          />
        ))}
      </div>
    </div>
  );
}
