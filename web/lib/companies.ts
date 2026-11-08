import "server-only";
import { cacheLife } from "next/cache";

// The SEC's list of every ticker and the company it belongs to. The database
// only stores tickers, so names come from here.
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

interface TickerEntry {
  ticker: string;
  title: string;
}

const SUFFIXES: Record<string, string> = {
  CO: "Co",
  CORP: "Corp",
  INC: "Inc",
  LTD: "Ltd",
};

// Many SEC names are in capitals, like "BERKSHIRE HATHAWAY INC", sometimes
// with a state suffix like "/DE/". Turn those into "Berkshire Hathaway Inc".
// Short words and ones with symbols, like "AT&T" or "IBM", stay as they are,
// and names already in mixed case are left alone.
export function displayName(title: string): string {
  const name = title.replace(/\s*\/[A-Z]+\/?$/, "").trim();
  if (name !== name.toUpperCase()) return name;
  return name
    .split(" ")
    .map((word) => {
      const bare = word.replace(/[.,]$/, "");
      if (SUFFIXES[bare]) return SUFFIXES[bare] + word.slice(bare.length);
      if (bare.length <= 3 || /[^A-Z]/.test(bare)) return word;
      return word[0] + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export async function getCompanyNames(): Promise<Record<string, string>> {
  "use cache";
  cacheLife("days");

  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) return {};
  try {
    const response = await fetch(TICKERS_URL, {
      headers: { "User-Agent": userAgent },
    });
    if (!response.ok) return {};
    const entries: Record<string, TickerEntry> = await response.json();
    return Object.fromEntries(
      Object.values(entries).map((entry) => [entry.ticker, displayName(entry.title)]),
    );
  } catch {
    // Names are a nice-to-have. Pages fall back to tickers alone.
    return {};
  }
}
