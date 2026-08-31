export type ActivityStream = "job" | "candidate" | "marketing" | "finance" | "all";

export type ActivityRow = {
  id: string;
  stream: ActivityStream;
  action: string;
  actionLabel: string;
  createdAt: Date;
  actorName: string;
  actorHref?: string;
  entityLabel: string;
  entityHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  metadata?: unknown;
};
