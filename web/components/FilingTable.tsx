"use client";

import Link from "next/link";
import { useState } from "react";
import type { FilingSummary, Form } from "@/lib/data";
import { formatDate } from "@/lib/format";
import FormBadge from "./FormBadge";
import SentimentBadge from "./SentimentBadge";

const FORMS: (Form | "All")[] = ["All", "10-K", "10-Q", "8-K"];

const matches = (filing: FilingSummary, query: string) => {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    filing.ticker.toLowerCase().includes(q) ||
    (filing.companyName?.toLowerCase().includes(q) ?? false)
  );
};

const FilingTable = ({ filings }: { filings: FilingSummary[] }) => {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Form | "All">("All");

  const shown = filings.filter(
    (filing) => (form === "All" || filing.form === form) && matches(filing, query),
  );

  return (
    <section aria-labelledby="filings-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="filings-heading" className="font-serif text-2xl font-semibold text-ink">
          Latest filings
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="filing-search">
            Search by ticker or company
          </label>
          <input
            id="filing-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ticker or company"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-2 focus:outline-brand/20 sm:w-64"
          />
          <div
            role="group"
            aria-label="Filter by form"
            className="inline-flex rounded-md border border-line bg-surface p-0.5"
          >
            {FORMS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={form === option}
                onClick={() => setForm(option)}
                className="h-8 flex-1 rounded px-3 text-sm font-medium text-ink-2 hover:text-ink aria-pressed:bg-brand aria-pressed:text-white sm:flex-none"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {shown.length === filings.length
          ? `${filings.length} filings`
          : `${shown.length} of ${filings.length} filings`}
      </p>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
          No filings match. Try a different ticker or form.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-line bg-paper text-xs font-medium tracking-wide text-muted uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Company</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Form</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Filed</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Sentiment</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((filing) => (
                // On small screens each row stacks into a card. The ticker
                // link stretches over the whole row, so the row is the target.
                <tr
                  key={filing.accessionNumber}
                  className="relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 py-4 hover:bg-paper md:table-row md:p-0"
                >
                  <td className="md:px-4 md:py-3.5 md:align-top">
                    <Link
                      href={`/filings/${filing.accessionNumber}`}
                      className="font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:outline-2 after:focus-visible:outline-brand"
                    >
                      {filing.ticker}
                    </Link>
                    {filing.companyName && (
                      <span className="block max-w-48 truncate text-xs text-muted">
                        {filing.companyName}
                      </span>
                    )}
                  </td>
                  <td className="justify-self-end md:px-4 md:py-3.5 md:align-top">
                    <FormBadge form={filing.form} />
                  </td>
                  <td className="text-ink-2 tabular-nums md:px-4 md:py-3.5 md:align-top md:whitespace-nowrap">
                    {formatDate(filing.filingDate)}
                  </td>
                  <td className="justify-self-end md:px-4 md:py-3.5 md:align-top">
                    <SentimentBadge score={filing.sentimentScore} />
                  </td>
                  <td className="col-span-2 text-ink-2 md:px-4 md:py-3.5 md:align-top">
                    <p className="line-clamp-2">{filing.summary}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default FilingTable;
