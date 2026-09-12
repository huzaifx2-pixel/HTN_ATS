import quotes from "@/data/islamic-quotes.json";

export type IslamicQuote = {
  text: string;
};

const ISLAMIC_QUOTES = quotes as IslamicQuote[];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Stable quote for a login session — changes when session id changes. */
export function getIslamicQuoteForSession(sessionId: string): IslamicQuote {
  if (ISLAMIC_QUOTES.length === 0) {
    return { text: "Verily, with hardship comes ease." };
  }
  const index = hashString(sessionId) % ISLAMIC_QUOTES.length;
  return { text: ISLAMIC_QUOTES[index]!.text };
}

export function islamicQuoteCount() {
  return ISLAMIC_QUOTES.length;
}
