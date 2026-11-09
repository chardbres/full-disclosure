import argparse
import sys
from collections import Counter
from functools import cache

import anthropic
import psycopg
import requests
from pydantic import BaseModel, Field

import db
import edgar

MODEL = "claude-sonnet-5-5"

SYSTEM_PROMPT = """You analyze SEC filings for investors.

For 10-K and 10-Q filings, base your analysis on the Risk Factors and Management's \
Discussion and Analysis (MD&A) sections. Headings and item numbers vary between \
companies, so find these sections by their content. Use the rest of the filing only \
as context. If the Risk Factors section only refers back to an earlier annual report, \
treat that as no material change to risks.

For 8-K filings, analyze the event the filing reports, including any attached press \
release (Exhibit 99.1).

Base every statement on the filing text, and include figures where the filing gives \
them. Do not use outside knowledge about the company or predict its stock price."""


class FilingAnalysis(BaseModel):
    summary: str = Field(
        description="Two to four sentences, in plain English, on what the filing says"
    )
    key_changes: list[str] = Field(
        description="Up to six of the most material changes from prior periods "
        "or prior disclosures, one sentence each, most important first"
    )
    risks: list[str] = Field(
        description="Up to six of the most significant risks, with new or newly "
        "emphasized risks first"
    )
    sentiment_score: int = Field(
        description="Overall tone for investors, from -5 (very negative) to 5 (very positive), with 0 neutral"
    )
    sentiment_rationale: str = Field(
        description="One sentence explaining the sentiment score"
    )


@cache
def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


def analyze_filing(filing: dict, text: str) -> FilingAnalysis:
    response = _client().beta.messages.parse(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "medium"},
        # If a safety classifier declines, retry on Anthropic's recommended fallback model
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f'<filing form="{filing["form"]}" filed="{filing["filing_date"]}">\n'
                f"{text}\n</filing>\n\nAnalyze this filing.",
            }
        ],
        output_format=FilingAnalysis,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(
            f"Claude declined to analyze this filing: {response.stop_details}"
        )
    if response.stop_reason == "max_tokens":
        raise RuntimeError("Analysis was cut off by the max_tokens limit")
    return response.parsed_output


def to_markdown(ticker: str, filing: dict, url: str, analysis: FilingAnalysis) -> str:
    key_changes = "\n".join(f"- {change}" for change in analysis.key_changes)
    risks = "\n".join(f"- {risk}" for risk in analysis.risks)
    return f"""# {ticker.upper()} {filing["form"]}, filed {filing["filing_date"]}

[View the filing on EDGAR]({url})

## Summary

{analysis.summary}

## Key changes

{key_changes}

## Risks

{risks}

## Sentiment: {analysis.sentiment_score:+d} (scale of -5 to +5)

{analysis.sentiment_rationale}
"""


# Errors that skip one ticker or filing without stopping the rest of the run
RECOVERABLE_ERRORS = (
    ValueError,
    RuntimeError,
    requests.RequestException,
    anthropic.APIError,
    psycopg.Error,
)


def describe(ticker: str, filing: dict) -> str:
    return (
        f"{ticker.upper()} {filing['form']} filed {filing['filing_date']} "
        f"({filing['accession_number']})"
    )


def find_new_filings(
    conn: psycopg.Connection, tickers: list[str], days: int
) -> tuple[list[tuple[str, int, dict]], list[str]]:
    """Each filing worth summarizing from the last `days` days that isn't in the
    database yet, as (ticker, cik, filing), newest first, and the tickers that
    failed."""
    pending, failed = [], []
    for ticker in tickers:
        try:
            cik = edgar.find_cik(ticker)
            filings = edgar.filings_to_analyze(cik, days)
            new = [
                f for f in filings if not db.is_analyzed(conn, f["accession_number"])
            ]
        except RECOVERABLE_ERRORS as e:
            print(f"Error ({ticker}): {e}", file=sys.stderr)
            failed.append(ticker)
            continue
        done = len(filings) - len(new)
        print(
            f"{ticker.upper()}: {len(new)} new, {done} already analyzed",
            file=sys.stderr,
        )
        pending += [(ticker, cik, f) for f in new]
    # Newest first across all companies, so a capped run does the latest news
    pending.sort(key=lambda p: p[2]["filing_date"], reverse=True)
    return pending, failed


def analyze_and_save(
    conn: psycopg.Connection, ticker: str, cik: int, filing: dict
) -> None:
    analysis = analyze_filing(filing, edgar.get_filing_text(cik, filing))
    url = edgar.filing_url(cik, filing["accession_number"], filing["primary_document"])
    db.save_analysis(conn, ticker, cik, filing, url, MODEL, analysis.model_dump())
    print(to_markdown(ticker, filing, url, analysis))
    print(f"Saved {describe(ticker, filing)}", file=sys.stderr)


def run(
    conn: psycopg.Connection,
    tickers: list[str],
    days: int,
    max_filings: int,
    dry_run: bool = False,
) -> list[str]:
    """Analyzes new filings for each ticker and returns what failed."""
    pending, failed = find_new_filings(conn, tickers, days)
    batch, over_cap = pending[:max_filings], pending[max_filings:]

    if dry_run:
        for ticker, _, filing in batch:
            print(describe(ticker, filing))
        counts = Counter(filing["form"] for _, _, filing in batch)
        breakdown = ", ".join(f"{n} {form}" for form, n in sorted(counts.items()))
        noun = "filing" if len(batch) == 1 else "filings"
        print(
            f"Would analyze {len(batch)} {noun}"
            + (f": {breakdown}" if breakdown else ""),
            # Keep this before the warnings below when output is redirected
            flush=True,
        )
    else:
        for ticker, cik, filing in batch:
            try:
                analyze_and_save(conn, ticker, cik, filing)
            except RECOVERABLE_ERRORS as e:
                print(f"Error ({describe(ticker, filing)}): {e}", file=sys.stderr)
                failed.append(describe(ticker, filing))

    if over_cap:
        print(
            f"Stopped at --max {max_filings}. Run again to analyze the other "
            f"{len(over_cap)}:",
            file=sys.stderr,
        )
        for ticker, _, filing in over_cap:
            print(f"  {describe(ticker, filing)}", file=sys.stderr)
    return failed


def positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze recent SEC filings with Claude and save them to the database."
    )
    parser.add_argument("tickers", nargs="+", help="ticker symbols, such as AAPL MSFT")
    parser.add_argument(
        "--days",
        type=positive_int,
        default=7,
        help="how many days back to look for filings (default: 7)",
    )
    parser.add_argument(
        "--max",
        type=positive_int,
        default=15,
        dest="max_filings",
        help="most filings to analyze in one run (default: 15)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="list the filings that would be analyzed, without calling Claude or saving",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_args(sys.argv[1:])
    try:
        conn = db.connect()
    except (RuntimeError, psycopg.Error) as e:
        print(f"Error: could not connect to the database: {e}", file=sys.stderr)
        sys.exit(1)

    with conn:
        failed = run(conn, args.tickers, args.days, args.max_filings, args.dry_run)

    if failed:
        print(f"Failed: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)
