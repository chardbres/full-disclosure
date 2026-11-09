"use client";

import { useActionState, useState } from "react";
import { type AnalysisState, startAnalysis } from "@/lib/analysis-actions";

const RUNS_URL = "https://github.com/chardbres/full-disclosure/actions/workflows/analyze.yml";
const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];
// The pipeline's --max default
const MAX_PER_RUN = 15;

interface PendingFiling {
  form: string;
  filingDate: string;
}

// The admin's Analyze panel on a company page. It previews which of the
// company's unanalyzed filings fall in the chosen window, then starts the
// GitHub Action through the startAnalysis server action.
const AnalyzePanel = ({ ticker, pending }: { ticker: string; pending: PendingFiling[] }) => {
  const [days, setDays] = useState(90);
  // Read the clock once, not on every render
  const [today] = useState(() => Date.now());
  const [dryRun, setDryRun] = useState(false);
  const [state, action, running] = useActionState<AnalysisState, FormData>(startAnalysis, {
    status: "idle",
    message: "",
  });

  // Same cutoff as the pipeline: filed on or after `days` days ago
  const since = new Date(today - days * 86_400_000).toISOString().slice(0, 10);
  const inWindow = pending.filter((filing) => filing.filingDate >= since);
  const counts = Object.entries(
    inWindow.reduce<Record<string, number>>((tally, { form }) => {
      tally[form] = (tally[form] ?? 0) + 1;
      return tally;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));
  const plural = inWindow.length === 1 ? "filing" : "filings";

  return (
    <section
      aria-labelledby="analyze-heading"
      className="mt-8 rounded-lg border border-brand/30 bg-surface p-5"
    >
      <h2 id="analyze-heading" className="font-serif text-xl font-semibold text-ink">
        Analyze filings <span className="text-sm font-normal text-muted">· only you see this</span>
      </h2>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="ticker" value={ticker} />
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-2 text-sm text-ink-2">Look back</legend>
          {WINDOWS.map((window) => (
            <label
              key={window.days}
              className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand has-checked:text-white"
            >
              <input
                type="radio"
                name="days"
                value={window.days}
                checked={days === window.days}
                onChange={() => setDays(window.days)}
                className="sr-only"
              />
              {window.label}
            </label>
          ))}
        </fieldset>

        <p className="text-sm text-ink-2" aria-live="polite">
          {inWindow.length === 0
            ? "Nothing new to analyze in this window."
            : `${inWindow.length} ${plural} not yet analyzed: ${counts
                .map(([form, n]) => `${n} ${form}`)
                .join(", ")}.`}
          {inWindow.length > MAX_PER_RUN &&
            ` One run analyzes the newest ${MAX_PER_RUN}. Run it again for the rest.`}
        </p>

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            name="dryRun"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
            className="size-4 accent-brand"
          />
          Preview only: list the filings in the run&rsquo;s log, without calling Claude
        </label>

        <button
          type="submit"
          disabled={running || (inWindow.length === 0 && !dryRun)}
          className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {running
            ? "Starting…"
            : dryRun
              ? "Start preview"
              : inWindow.length === 0
                ? "Nothing to analyze"
                : `Analyze ${Math.min(inWindow.length, MAX_PER_RUN)} ${
                  Math.min(inWindow.length, MAX_PER_RUN) === 1 ? "filing" : "filings"
                }`}
        </button>
      </form>

      {state.status !== "idle" && (
        <p
          role="status"
          className={`mt-4 rounded-md p-3 text-sm ${
            state.status === "error" ? "bg-negative-soft text-negative" : "bg-positive-soft text-ink"
          }`}
        >
          {state.message}{" "}
          {state.status === "started" && (
            <a href={RUNS_URL} className="font-medium underline">
              Watch it on GitHub ↗
            </a>
          )}
        </p>
      )}
    </section>
  );
};

export default AnalyzePanel;
