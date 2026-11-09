import "server-only";
import { cacheLife } from "next/cache";
import type { Sql } from "postgres";
import { db } from "./db";
import { getCompanies } from "./companies";
import { type EdgarFiling, getRecentFilings } from "./edgar";
import { tickerKey } from "./format";

export type Form = "10-K" | "10-Q" | "8-K";

export interface FilingSummary {
  accessionNumber: string;
  ticker: string;
  companyName: string | null;
  form: Form;
  filingDate: string;
  summary: string;
  sentimentScore: number;
}

export interface FilingAnalysis extends FilingSummary {
  url: string;
  keyChanges: string[];
  risks: string[];
  sentimentRationale: string;
  model: string;
  analyzedOn: string;
}

// A filing can be analyzed more than once, for example with a newer model.
// Pages show the most recent analysis of each filing.
const latestAnalyses = (sql: Sql) => {
  return sql`
    select distinct on (accession_number) *
    from analyses
    order by accession_number, created_at desc
  `;
};

const withNames = async <T extends { ticker: string }>(
  rows: T[],
): Promise<(T & { companyName: string | null })[]> => {
  const companies = await getCompanies();
  return rows.map((row) => ({
    ...row,
    companyName: companies[tickerKey(row.ticker)]?.name ?? null,
  }));
};

export const getFilings = async (): Promise<FilingSummary[]> => {
  "use cache";
  cacheLife("hours");

  const sql = db();
  const rows = await sql<Omit<FilingSummary, "companyName">[]>`
    select f.accession_number as "accessionNumber", f.ticker, f.form,
      f.filing_date::text as "filingDate", l.summary,
      l.sentiment_score as "sentimentScore"
    from filings f
    join (${latestAnalyses(sql)}) l using (accession_number)
    order by f.filing_date desc, f.ticker
  `;
  return withNames(rows);
};

export const getFiling = async (
  accessionNumber: string,
): Promise<FilingAnalysis | null> => {
  "use cache";
  cacheLife("hours");

  const sql = db();
  const rows = await sql<Omit<FilingAnalysis, "companyName">[]>`
    select f.accession_number as "accessionNumber", f.ticker, f.form,
      f.filing_date::text as "filingDate", f.url, l.summary,
      l.key_changes as "keyChanges", l.risks,
      l.sentiment_score as "sentimentScore",
      l.sentiment_rationale as "sentimentRationale", l.model,
      (l.created_at at time zone 'utc')::date::text as "analyzedOn"
    from filings f
    join (${latestAnalyses(sql)}) l using (accession_number)
    where f.accession_number = ${accessionNumber}
  `;
  if (!rows.length) return null;
  const [filing] = await withNames(rows);
  return filing;
};

// The most recent filings, prerendered at build time. Others render on
// their first visit.
export const getRecentAccessionNumbers = async (
  limit = 50,
): Promise<string[]> => {
  "use cache";
  cacheLife("hours");

  const rows = await db()<{ accessionNumber: string }[]>`
    select accession_number as "accessionNumber"
    from filings
    order by filing_date desc
    limit ${limit}
  `;
  return rows.map((row) => row.accessionNumber);
};

export interface CompanyOverview {
  ticker: string;
  name: string | null;
  cik: number | null;
  analyzed: FilingSummary[];
  // null when EDGAR couldn't be reached
  edgarFilings: EdgarFiling[] | null;
}

// Everything the company page shows. A company counts if the SEC lists it or
// it has analyses, so the page still works if the SEC's list can't be loaded.
export const getCompany = async (ticker: string): Promise<CompanyOverview | null> => {
  const key = tickerKey(ticker);
  const [companies, filings] = await Promise.all([getCompanies(), getFilings()]);
  const company = companies[key];
  const analyzed = filings.filter((filing) => tickerKey(filing.ticker) === key);
  if (!company && !analyzed.length) return null;

  const edgarFilings = company
    ? await getRecentFilings(company.cik).catch(() => null)
    : null;
  return {
    ticker: key,
    name: company?.name ?? analyzed[0]?.companyName ?? null,
    cik: company?.cik ?? null,
    analyzed,
    edgarFilings,
  };
};
