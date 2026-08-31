const ONLINE_TTL_MS = 45_000;

type PresenceEntry = {
  userId: string;
  name: string;
  lastSeen: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __headsbasePresence: Map<string, Map<string, PresenceEntry>> | undefined;
}

function getStore() {
  if (!globalThis.__headsbasePresence) {
    globalThis.__headsbasePresence = new Map();
  }
  return globalThis.__headsbasePresence;
}

export function touchPresence(organizationId: string, userId: string, name: string) {
  const store = getStore();
  let org = store.get(organizationId);
  if (!org) {
    org = new Map();
    store.set(organizationId, org);
  }
  org.set(userId, { userId, name, lastSeen: Date.now() });
}

export function clearPresence(organizationId: string, userId: string) {
  getStore().get(organizationId)?.delete(userId);
}

export function countOnlineMembers(organizationId: string) {
  const now = Date.now();
  const org = getStore().get(organizationId);
  if (!org) return 0;

  let online = 0;
  for (const entry of org.values()) {
    if (now - entry.lastSeen <= ONLINE_TTL_MS) online += 1;
  }
  return online;
}
