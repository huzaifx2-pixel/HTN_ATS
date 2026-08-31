const STORAGE_PREFIX = "headsbase.recentTalentSearches.";
const MAX_RECENTS = 25;

export type RecentTalentSearch = {
  href: string;
  label: string;
  mode: string;
  jobLabel?: string;
  queriedAt: number;
};

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readRecentTalentSearches(userId: string): RecentTalentSearch[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentTalentSearch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.href === "string" &&
        item.href.startsWith("/candidates/search") &&
        typeof item.label === "string",
    );
  } catch {
    return [];
  }
}

function writeRecentTalentSearches(userId: string, items: RecentTalentSearch[]) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, MAX_RECENTS)));
}

export function recordRecentTalentSearch(userId: string, entry: Omit<RecentTalentSearch, "queriedAt"> & { queriedAt?: number }) {
  if (typeof window === "undefined" || !userId || !entry.href) return;
  const next: RecentTalentSearch = {
    ...entry,
    queriedAt: entry.queriedAt ?? Date.now(),
  };
  const existing = readRecentTalentSearches(userId).filter((item) => item.href !== next.href);
  writeRecentTalentSearches(userId, [next, ...existing]);
}

export function removeRecentTalentSearch(userId: string, href: string) {
  if (typeof window === "undefined" || !userId) return;
  writeRecentTalentSearches(
    userId,
    readRecentTalentSearches(userId).filter((item) => item.href !== href),
  );
}

export function clearRecentTalentSearches(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(storageKey(userId));
}

export function formatRecentSearchLabel(input: {
  query?: string;
  mode?: string;
  jobLabel?: string;
  extras?: string[];
}) {
  const query = input.query?.replace(/\s+/g, " ").trim();
  const shortQuery = query ? (query.length > 90 ? `${query.slice(0, 90)}…` : query) : "";
  const jobCode = input.jobLabel?.split(" · ")[0]?.trim();
  const extras = (input.extras ?? []).map((value) => value.trim()).filter(Boolean);
  const parts = [
    jobCode,
    shortQuery || (input.mode ? `${input.mode} search` : "Search"),
    extras.length ? extras.join(" · ") : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
