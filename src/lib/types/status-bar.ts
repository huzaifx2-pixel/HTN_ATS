export type StatusBarSnapshot = {
  gmailImportsToday: number;
  pendingInboxCount: number;
  gmailConnected: boolean;
  lastSyncAt: string | null;
  gmailSyncFailedRecently: number;
  onlineCount: number;
  teamMemberCount: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
};
