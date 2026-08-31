export type RealtimeEventType =
  | "connected"
  | "sync"
  | "status"
  | "message"
  | "pipeline"
  | "candidates"
  | "jobs"
  | "inbox";

export type RealtimeEvent = {
  type: RealtimeEventType;
  at: number;
  paths?: string[];
  channelId?: string;
  jobId?: string;
  organizationId?: string;
};

export const REALTIME_EVENT = "headsbase:realtime";
