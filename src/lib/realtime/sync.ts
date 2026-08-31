import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth/session";
import { inferEventType, publishOrgEvent } from "@/lib/realtime/hub";
import type { RealtimeEventType } from "@/lib/realtime/types";

type SyncOptions = {
  organizationId?: string;
  type?: RealtimeEventType;
  channelId?: string;
  jobId?: string;
};

export async function revalidateOrgPaths(paths: string[], options: SyncOptions = {}) {
  const organizationId = options.organizationId ?? (await requireOrgContext()).organizationId;

  for (const path of paths) {
    revalidatePath(path, "page");
  }

  if (paths.some((path) => path.startsWith("/jobs"))) {
    revalidatePath("/jobs", "layout");
  }

  publishOrgEvent(organizationId, {
    type: options.type ?? inferEventType(paths),
    paths,
    channelId: options.channelId,
    jobId: options.jobId,
  });
}

export function broadcastOrgSync(
  organizationId: string,
  options: Omit<SyncOptions, "organizationId"> & { paths?: string[] } = {},
) {
  const paths = options.paths ?? ["/dashboard"];
  const type = options.type ?? inferEventType(paths);
  publishOrgEvent(organizationId, {
    type,
    paths,
    channelId: options.channelId,
    jobId: options.jobId,
  });
  if (type === "inbox" || paths.some((path) => path.includes("/dashboard"))) {
    publishOrgEvent(organizationId, { type: "status", paths: ["/dashboard"] });
  }
}
