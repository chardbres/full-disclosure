"use server";

import { getAdmin } from "./auth";
import { getCompanies } from "./companies";
import { tickerKey } from "./format";

const REPO = "chardbres/full-disclosure";
const WORKFLOW = "analyze.yml";

// The lookback windows the Analyze panel offers
const WINDOWS = new Set([30, 90, 365]);

export interface AnalysisState {
  status: "idle" | "started" | "error";
  message: string;
}

// Starts the GitHub Action for one company, for the admin only. The Action
// runs the Python pipeline, which skips filings already analyzed and stops at
// 15 per run.
export const startAnalysis = async (
  _previous: AnalysisState,
  formData: FormData,
): Promise<AnalysisState> => {
  // Checked here on the server, so the button alone can't spend tokens
  if (!(await getAdmin())) {
    return { status: "error", message: "Sign in as the admin to analyze filings." };
  }

  const ticker = tickerKey(String(formData.get("ticker") ?? ""));
  const days = Number(formData.get("days"));
  const dryRun = formData.get("dryRun") === "on";
  if (!WINDOWS.has(days)) return { status: "error", message: "Choose 30, 90 or 365 days." };
  if (!(await getCompanies())[ticker]) {
    return { status: "error", message: `${ticker} isn't in the SEC's list of companies.` };
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { status: "error", message: "GITHUB_DISPATCH_TOKEN isn't set on the server." };

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { tickers: ticker, days: String(days), dry_run: String(dryRun) },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => null);

  if (!response?.ok) {
    console.error("Workflow dispatch failed", response?.status, await response?.text());
    return {
      status: "error",
      message: `GitHub didn't start the run${response ? ` (status ${response.status})` : ""}. Check the token's permissions.`,
    };
  }
  return {
    status: "started",
    message: dryRun
      ? `Preview started for ${ticker}. The list of filings appears in the run's log in a minute or two.`
      : `Started for ${ticker}. Setup takes a minute or two, then about a minute per filing. New analyses appear here when it finishes.`,
  };
};
