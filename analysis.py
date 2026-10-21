import sys
from functools import cache
from pathlib import Path

import anthropic
import requests
from pydantic import BaseModel, Field

import edgar

MODEL = "claude-sonnet-5-5"
ANALYSES_DIR = Path("analyses")

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


if __name__ == "__main__":
    tickers = sys.argv[1:] or ["AAPL"]
    failed = []
    for ticker in tickers:
        try:
            cik = edgar.find_cik(ticker)
            filing = next(
                f
                for f in edgar.get_filings(cik, since="2026-01-01")
                if edgar.is_worth_summarizing(f)
            )
            report_path = (
                ANALYSES_DIR
                / f"{ticker.upper()}-{filing['form']}-{filing['filing_date']}.md"
            )
            if report_path.exists():
                print(
                    f"Skipping {ticker}: already analyzed ({report_path})",
                    file=sys.stderr,
                )
                continue
            print(filing["filing_date"], filing["form"], file=sys.stderr)
            analysis = analyze_filing(filing, edgar.get_filing_text(cik, filing))
            url = edgar.filing_url(
                cik, filing["accession_number"], filing["primary_document"]
            )
            report = to_markdown(ticker, filing, url, analysis)

            ANALYSES_DIR.mkdir(exist_ok=True)
            report_path.write_text(report)
            print(report)
            print(f"Saved to {report_path}", file=sys.stderr)
        except StopIteration:
            print(f"Error: no filings worth summarizing for {ticker}", file=sys.stderr)
            failed.append(ticker)
        except (
            ValueError,
            RuntimeError,
            requests.RequestException,
            anthropic.APIError,
        ) as e:
            print(f"Error: {e}", file=sys.stderr)
            failed.append(ticker)

    if failed:
        print(f"Failed: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)
