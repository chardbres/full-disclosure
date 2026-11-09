import "server-only";
import { cacheLife } from "next/cache";
import { tickerKey } from "./format";

// The SEC's list of every ticker and the company it belongs to. The database
// only stores tickers, so names come from here.
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export interface Company {
  ticker: string;
  cik: number;
  name: string;
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
export const displayName = (title: string): string => {
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
};

// The SEC can be slow to answer requests from cloud servers, so give up after
// a few seconds rather than hold up the page.
export const SEC_TIMEOUT_MS = 5000;

const fetchCompanies = async (): Promise<Record<string, Company>> => {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) return {};
  try {
    const response = await fetch(TICKERS_URL, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(SEC_TIMEOUT_MS),
    });
    if (!response.ok) return {};
    const entries: Record<string, TickerEntry> = await response.json();
    return Object.fromEntries(
      Object.values(entries).map((entry) => [
        entry.ticker,
        { ticker: entry.ticker, cik: entry.cik_str, name: displayName(entry.title) },
      ]),
    );
  } catch {
    // Names are a nice-to-have. Pages fall back to tickers alone.
    return {};
  }
};

// Pages rendered at the same time, as during a build, share one download
// instead of each asking the SEC, which rate-limits heavy use.
let pending: Promise<Record<string, Company>> | undefined;

// Every company the SEC lists, keyed by ticker, in the SEC's order, which is
// roughly largest first
export const getCompanies = async (): Promise<Record<string, Company>> => {
  "use cache";
  cacheLife("days");

  pending ??= fetchCompanies().finally(() => {
    pending = undefined;
  });
  return pending;
};

// Up to `limit` companies matching a search, best matches first: the exact
// ticker, then tickers starting with the query, then names starting with it,
// then names with a word starting with it. Ties keep the SEC's order, so
// bigger companies come first.
export const searchCompanies = async (query: string, limit = 8): Promise<Company[]> => {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const rank = ({ ticker, name }: Company): number => {
    const upperName = name.toUpperCase();
    if (ticker === tickerKey(q)) return 0;
    if (ticker.startsWith(q)) return 1;
    if (upperName.startsWith(q)) return 2;
    if (upperName.includes(` ${q}`)) return 3;
    return Infinity;
  };
  return Object.values(await getCompanies())
    .map((company) => ({ company, rank: rank(company) }))
    .filter(({ rank }) => rank < Infinity)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ company }) => company);
};
