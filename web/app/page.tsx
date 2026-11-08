import FilingTable from "@/components/FilingTable";
import StatTile from "@/components/StatTile";
import { getFilings } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function Home() {
  const filings = await getFilings();
  const companies = new Set(filings.map((filing) => filing.ticker)).size;

  return (
    <>
      <section className="max-w-2xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          SEC filings, read for you.
        </h1>
        <p className="mt-4 text-lg text-ink-2">
          Full Disclosure pulls annual, quarterly and current reports from SEC
          EDGAR and has Claude summarize each one: what changed, the biggest
          risks and the overall tone for investors.
        </p>
      </section>

      <dl className="mt-10 grid gap-3 sm:grid-cols-3">
        <StatTile label="Companies" value={companies.toLocaleString("en-US")} />
        <StatTile label="Filings analyzed" value={filings.length.toLocaleString("en-US")} />
        <StatTile
          label="Most recent filing"
          value={filings.length ? formatDate(filings[0].filingDate) : "None yet"}
        />
      </dl>

      <div className="mt-12">
        <FilingTable filings={filings} />
      </div>
    </>
  );
}
