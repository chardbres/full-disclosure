import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FormBadge from "@/components/FormBadge";
import SentimentScale from "@/components/SentimentScale";
import { getFiling, getRecentAccessionNumbers } from "@/lib/data";
import { FORM_DESCRIPTIONS, formatDate } from "@/lib/format";

// SEC accession numbers look like 0000320193-26-000105
const ACCESSION_NUMBER = /^\d{10}-\d{2}-\d{6}$/;

const findFiling = async (accession: string) => {
  return ACCESSION_NUMBER.test(accession) ? getFiling(accession) : null;
};

export const generateStaticParams = async () => {
  const recent = await getRecentAccessionNumbers();
  // Cache Components needs at least one entry. With an empty database the
  // placeholder renders as not found.
  return recent.length
    ? recent.map((accession) => ({ accession }))
    : [{ accession: "none" }];
};

export const generateMetadata = async ({
  params,
}: PageProps<"/filings/[accession]">): Promise<Metadata> => {
  const filing = await findFiling((await params).accession);
  if (!filing) return { title: "Filing not found" };
  return {
    title: `${filing.ticker} ${filing.form}, filed ${formatDate(filing.filingDate)}`,
    description: filing.summary,
  };
};

const FilingPage = ({ params }: PageProps<"/filings/[accession]">) => {
  return (
    <>
      <Link href="/" className="text-sm font-medium text-ink-2 hover:text-ink">
        ← All filings
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Loading filing…</p>}>
        <FilingDetails params={params} />
      </Suspense>
    </>
  );
};

export default FilingPage;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
};

const NumberedList = ({ items, empty }: { items: string[]; empty: string }) => {
  if (!items.length) return <p className="text-ink-2">{empty}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-ink-2">
          <span className="w-5 shrink-0 text-right font-semibold text-muted tabular-nums">
            {index + 1}.
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
};

const FilingDetails = async ({ params }: Pick<PageProps<"/filings/[accession]">, "params">) => {
  const filing = await findFiling((await params).accession);
  if (!filing) notFound();

  const details = [
    ["Form", `${filing.form}, ${FORM_DESCRIPTIONS[filing.form].toLowerCase()}`],
    ["Filed", formatDate(filing.filingDate)],
    ["Accession number", filing.accessionNumber],
    ["Analyzed", formatDate(filing.analyzedOn)],
    ["Model", filing.model],
  ];

  return (
    <article className="mt-6">
      <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <FormBadge form={filing.form} />
            {FORM_DESCRIPTIONS[filing.form]}, filed {formatDate(filing.filingDate)}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-ink">
            {filing.companyName ?? filing.ticker}
          </h1>
          {filing.companyName && (
            <p className="mt-1 font-semibold text-ink-2">{filing.ticker}</p>
          )}
        </div>
        <a
          href={filing.url}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
        >
          Read the filing on EDGAR ↗
        </a>
      </header>

      {/* On phones the sentiment follows the summary. On wide screens it
          moves to a sidebar beside the summary, changes and risks. */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Section title="Summary">
          <p className="text-lg/8 text-ink">{filing.summary}</p>
        </Section>
        <aside className="space-y-6 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <Section title="Sentiment">
            <SentimentScale score={filing.sentimentScore} />
            <p className="mt-5 text-sm/6 text-ink-2">{filing.sentimentRationale}</p>
          </Section>
          <Section title="Details">
            <dl className="space-y-3 text-sm">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </aside>
        <Section title="Key changes">
          <NumberedList items={filing.keyChanges} empty="No material changes reported." />
        </Section>
        <Section title="Risks">
          <NumberedList items={filing.risks} empty="No significant risks reported." />
        </Section>
      </div>
    </article>
  );
};
