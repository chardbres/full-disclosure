import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FormBadge from "@/components/FormBadge";
import SentimentBadge from "@/components/SentimentBadge";
import { getCompany, getFilings } from "@/lib/data";
import { formatDate, tickerKey } from "@/lib/format";

// Letters, digits, dots and dashes, like AAPL or BRK-B
const TICKER = /^[A-Za-z0-9.-]{1,10}$/;

const findCompany = async (ticker: string) => {
  return TICKER.test(ticker) ? getCompany(ticker) : null;
};

// Prerender the companies that have analyses. Others render on first visit.
export const generateStaticParams = async () => {
  const tickers = new Set((await getFilings()).map((filing) => tickerKey(filing.ticker)));
  // Cache Components needs at least one entry
  return tickers.size ? [...tickers].map((ticker) => ({ ticker })) : [{ ticker: "AAPL" }];
};

export const generateMetadata = async ({
  params,
}: PageProps<"/companies/[ticker]">): Promise<Metadata> => {
  const company = await findCompany((await params).ticker);
  if (!company) return { title: "Company not found" };
  const name = company.name ? `${company.name} (${company.ticker})` : company.ticker;
  return {
    title: `${name} filings`,
    description: `AI summaries of ${name}'s SEC filings, with sentiment and key risks.`,
    // /companies/nvda shows the same page as /companies/NVDA
    alternates: { canonical: `/companies/${company.ticker}` },
  };
};

const CompanyPage = ({ params }: PageProps<"/companies/[ticker]">) => {
  return (
    <>
      <Link href="/" className="text-sm font-medium text-ink-2 hover:text-ink">
        ← All filings
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Loading company…</p>}>
        <CompanyDetails params={params} />
      </Suspense>
    </>
  );
};

export default CompanyPage;

const CompanyDetails = async ({ params }: Pick<PageProps<"/companies/[ticker]">, "params">) => {
  const company = await findCompany((await params).ticker);
  if (!company) notFound();

  const analyzedNumbers = new Set(company.analyzed.map((filing) => filing.accessionNumber));
  const card = "mt-4 overflow-hidden rounded-lg border border-line bg-surface";

  return (
    <article className="mt-6">
      <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
            {company.name ?? company.ticker}
          </h1>
          <p className="mt-1 font-semibold text-ink-2">
            {company.ticker}
            {company.cik && <span className="font-normal text-muted"> · CIK {company.cik}</span>}
          </p>
        </div>
        {company.cik && (
          <a
            href={`https://www.sec.gov/edgar/browse/?CIK=${company.cik}`}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
          >
            All filings on EDGAR ↗
          </a>
        )}
      </header>

      <section className="mt-8" aria-labelledby="analyzed-heading">
        <h2 id="analyzed-heading" className="font-serif text-2xl font-semibold text-ink">
          Analyzed filings
        </h2>
        {company.analyzed.length ? (
          <ul className={`${card} divide-y divide-line`}>
            {company.analyzed.map((filing) => (
              <li key={filing.accessionNumber} className="relative px-4 py-4 hover:bg-paper">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <FormBadge form={filing.form} />
                  <Link
                    href={`/filings/${filing.accessionNumber}`}
                    className="font-semibold text-ink tabular-nums after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:outline-2 after:focus-visible:outline-brand"
                  >
                    Filed {formatDate(filing.filingDate)}
                  </Link>
                  <span className="sm:ml-auto">
                    <SentimentBadge score={filing.sentimentScore} />
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-2">{filing.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${card} p-8 text-center text-sm text-muted`}>
            No analyses yet. Full Disclosure analyzes the companies on its
            watchlist each day.
          </p>
        )}
      </section>

      <section className="mt-12" aria-labelledby="edgar-heading">
        <h2 id="edgar-heading" className="font-serif text-2xl font-semibold text-ink">
          Recent filings on EDGAR
        </h2>
        <p className="mt-1 text-sm text-muted">
          Annual and quarterly reports, and current reports with material news,
          from the past year.
        </p>
        {company.edgarFilings === null ? (
          <p className={`${card} p-8 text-center text-sm text-muted`}>
            EDGAR couldn&rsquo;t be reached just now. Try again later.
          </p>
        ) : company.edgarFilings.length === 0 ? (
          <p className={`${card} p-8 text-center text-sm text-muted`}>
            No filings like these in the past year.
          </p>
        ) : (
          <ul className={`${card} divide-y divide-line text-sm`}>
            {company.edgarFilings.map((filing) => (
              <li
                key={filing.accessionNumber}
                className="grid grid-cols-[6.5rem_auto_1fr] items-center gap-x-3 px-4 py-3 sm:grid-cols-[7.5rem_auto_1fr] sm:gap-x-4"
              >
                <span className="text-ink-2 tabular-nums">{formatDate(filing.filingDate)}</span>
                <FormBadge form={filing.form} />
                <span className="justify-self-end">
                  {analyzedNumbers.has(filing.accessionNumber) ? (
                    <Link
                      href={`/filings/${filing.accessionNumber}`}
                      className="font-medium text-positive hover:underline"
                    >
                      <span className="hidden sm:inline">Read the analysis →</span>
                      <span className="sm:hidden">Analysis →</span>
                    </Link>
                  ) : (
                    <a
                      href={filing.url}
                      aria-label="Not analyzed. Read the filing on EDGAR"
                      className="text-muted hover:text-ink hover:underline"
                    >
                      Not analyzed<span className="hidden sm:inline"> · EDGAR</span> ↗
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
};
