export type GoogleCseItem = {
  title: string;
  link: string;
  snippet?: string;
  pagemap?: {
    cse_image?: Array<{ src?: string }>;
    metatags?: Array<Record<string, string>>;
  };
};

export function getGoogleCseStatus() {
  const apiKey = process.env.GOOGLE_CSE_API_KEY?.trim() ?? "";
  const cx = process.env.GOOGLE_CSE_ID?.trim() ?? "";
  return {
    hasApiKey: Boolean(apiKey),
    hasEngineId: Boolean(cx),
    configured: Boolean(apiKey && cx),
  };
}

export function isGoogleCseConfigured() {
  return getGoogleCseStatus().configured;
}

export function getGoogleCseConfig() {
  const apiKey = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!apiKey || !cx) return null;
  return { apiKey, cx };
}

export async function searchGoogleCse(query: string, start = 1, num = 10): Promise<{
  items: GoogleCseItem[];
  totalEstimated: number;
}> {
  const config = getGoogleCseConfig();
  if (!config) {
    throw new Error("Google Custom Search is not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID.");
  }

  const params = new URLSearchParams({
    key: config.apiKey,
    cx: config.cx,
    q: query,
    num: String(Math.min(Math.max(num, 1), 10)),
    start: String(Math.max(start, 1)),
  });

  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
    headers: { Accept: "application/json" },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } }).error?.message ||
      `Google Custom Search failed (${res.status})`;
    throw new Error(message);
  }

  const data = body as {
    items?: GoogleCseItem[];
    searchInformation?: { totalResults?: string };
  };

  return {
    items: data.items ?? [],
    totalEstimated: Number(data.searchInformation?.totalResults ?? 0) || 0,
  };
}
