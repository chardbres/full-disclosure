from types import SimpleNamespace

import pytest
import analysis
from analysis import FilingAnalysis, analyze_filing, to_markdown

# A filing and analysis shared by the to_markdown tests
FILING = {"form": "10-Q", "filing_date": "2026-05-01"}
URL = "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/q.htm"

def make_analysis(**overrides):
    # Builds a FilingAnalysis with sensible defaults; tests override only the field they care about
    fields = {
        "summary": "Revenue grew.",
        "key_changes": ["Revenue up 10%.", "Margins down."],
        "risks": ["Supply chain."],
        "sentiment_score": 2,
        "sentiment_rationale": "Growth outweighs margin pressure.",
    }
    return FilingAnalysis(**(fields | overrides))


def test_to_markdown_full_output():
    # Checks the whole document once, so any layout change shows up as a clear diff
    assert to_markdown("aapl", FILING, URL, make_analysis()) == f"""# AAPL 10-Q, filed 2026-05-01

[View the filing on EDGAR]({URL})

## Summary

Revenue grew.

## Key changes

- Revenue up 10%.
- Margins down.

## Risks

- Supply chain.

## Sentiment: +2 (scale of -5 to +5)

Growth outweighs margin pressure.
"""


@pytest.mark.parametrize(
    "score, expected",
    [
        (3, "## Sentiment: +3"), # positive scores get an explicit plus sign
        (-2, "## Sentiment: -2"), # negative scores keep their minus sign
        (0, "## Sentiment: +0"), # zero is shown as +0, a side effect of the :+d format
    ]
)

def test_to_markdown_sentiment_sign(score, expected):
    assert expected in to_markdown("AAPL", FILING, URL, make_analysis(sentiment_score=score))

def test_to_markdown_empty_lists():
    # Claude may report no key changes (e.g. a routine 8-K). The heading stays
    # and the section is left empty instead of showing a stray bullet.
    markdown = to_markdown("AAPL", FILING, URL, make_analysis(key_changes=[]))
    assert "## Key changes\n\n\n\n## Risks" in markdown
    assert "- \n" not in markdown


# analyze_filing calls the Claude API through _client(). This fixture swaps in a
# fake client whose beta.messages.parse records the request and returns a
# response the test chooses, so no API key or network access is needed.
@pytest.fixture
def fake_claude(monkeypatch):
    requests = []
    def set_response(**response_fields):
        def parse(**kwargs):
            requests.append(kwargs)
            return SimpleNamespace(**response_fields)
        client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(parse=parse)))
        monkeypatch.setattr(analysis, "_client", lambda: client)
        return requests
    return set_response


def test_analyze_filing_returns_parsed_output(fake_claude):
    expected = make_analysis()
    fake_claude(stop_reason="end_turn", parsed_output=expected)
    assert analyze_filing(FILING, "Filing text.") is expected

def test_analyze_filing_sends_filing_in_prompt(fake_claude):
    requests = fake_claude(stop_reason="end_turn", parsed_output=make_analysis())
    analyze_filing(FILING, "Filing text.")
    request = requests[0]
    # The text is wrapped in a <filing> tag carrying the form and date, so
    # Claude knows which kind of filing it is reading
    content = request["messages"][0]["content"]
    assert '<filing form="10-Q" filed="2026-05-01">' in content
    assert "Filing text." in content
    # The response is parsed into FilingAnalysis using the configured model
    assert request["output_format"] is FilingAnalysis
    assert request["model"] == analysis.MODEL

def test_analyze_filing_refusal(fake_claude):
    # If Claude declines (even after the fallback model), the result is unusable,
    # so it raises and includes the stop details to explain why
    fake_claude(stop_reason="refusal", stop_details="policy reason", parsed_output=None)
    with pytest.raises(RuntimeError, match="declined.*policy reason"):
        analyze_filing(FILING, "Filing text.")

def test_analyze_filing_max_tokens(fake_claude):
    # A truncated response is incomplete, so it raises instead of returning a partial analysis
    fake_claude(stop_reason="max_tokens", parsed_output=None)
    with pytest.raises(RuntimeError, match="max_tokens"):
        analyze_filing(FILING, "Filing text.")


# run() fakes: three filings across two companies, one already in the database
def make_filing(form, filing_date, accession_number):
    return {
        "form": form,
        "filing_date": filing_date,
        "accession_number": accession_number,
        "primary_document": "doc.htm",
        "items": "",
    }

FILINGS = {
    "AAPL": [
        make_filing("10-K", "2026-11-03", "aapl-10k"),
        make_filing("10-Q", "2026-08-01", "aapl-10q"),
    ],
    "MSFT": [make_filing("10-Q", "2026-10-29", "msft-10q")],
    "OLD": [make_filing("10-Q", "2026-10-01", "old-10q")],
}
CIKS = {"AAPL": 1, "MSFT": 2, "OLD": 3}


@pytest.fixture
def fake_pipeline(monkeypatch):
    """Fakes EDGAR, the database and Claude, and records what gets saved."""
    saved = []
    analyzed = {"old-10q"}

    def find_cik(ticker):
        if ticker not in CIKS:
            raise ValueError(f"Unknown ticker: {ticker}")
        return CIKS[ticker]

    cik_to_ticker = {cik: ticker for ticker, cik in CIKS.items()}
    monkeypatch.setattr(analysis.edgar, "find_cik", find_cik)
    monkeypatch.setattr(
        analysis.edgar, "filings_to_analyze", lambda cik, days: FILINGS[cik_to_ticker[cik]]
    )
    monkeypatch.setattr(analysis.edgar, "get_filing_text", lambda cik, filing: "text")
    monkeypatch.setattr(analysis.db, "is_analyzed", lambda conn, acc: acc in analyzed)
    monkeypatch.setattr(
        analysis.db,
        "save_analysis",
        lambda conn, ticker, cik, filing, url, model, data: saved.append(filing["accession_number"]),
    )
    monkeypatch.setattr(analysis, "analyze_filing", lambda filing, text: make_analysis())
    return saved


def test_run_analyzes_new_filings_newest_first(fake_pipeline):
    # Every new filing is analyzed, newest first across companies, and the one
    # already in the database is skipped
    failed = analysis.run(None, ["AAPL", "MSFT", "OLD"], days=365, max_filings=15)
    assert fake_pipeline == ["aapl-10k", "msft-10q", "aapl-10q"]
    assert failed == []

def test_run_stops_at_max(fake_pipeline, capsys):
    # The cap keeps the newest filings and lists the rest for the next run
    analysis.run(None, ["AAPL", "MSFT"], days=365, max_filings=2)
    assert fake_pipeline == ["aapl-10k", "msft-10q"]
    assert "Run again to analyze the other 1" in capsys.readouterr().err

def test_run_dry_run_saves_nothing(fake_pipeline, capsys, monkeypatch):
    # A dry run lists the filings without calling Claude or saving
    def fail(*args):
        raise AssertionError("Claude was called during a dry run")
    monkeypatch.setattr(analysis, "analyze_filing", fail)
    analysis.run(None, ["AAPL", "MSFT"], days=365, max_filings=15, dry_run=True)
    out = capsys.readouterr().out
    assert fake_pipeline == []
    assert "AAPL 10-K filed 2026-11-03 (aapl-10k)" in out
    assert "Would analyze 3 filings: 1 10-K, 2 10-Q" in out

def test_run_continues_after_failed_filing(fake_pipeline, monkeypatch):
    # One filing failing doesn't stop the others, and it's reported
    def analyze(filing, text):
        if filing["accession_number"] == "msft-10q":
            raise RuntimeError("Claude declined")
        return make_analysis()
    monkeypatch.setattr(analysis, "analyze_filing", analyze)
    failed = analysis.run(None, ["AAPL", "MSFT"], days=365, max_filings=15)
    assert fake_pipeline == ["aapl-10k", "aapl-10q"]
    assert failed == ["MSFT 10-Q filed 2026-10-29 (msft-10q)"]

def test_run_unknown_ticker(fake_pipeline):
    # An unknown ticker is reported and the other companies still run
    failed = analysis.run(None, ["NOPE", "MSFT"], days=365, max_filings=15)
    assert fake_pipeline == ["msft-10q"]
    assert failed == ["NOPE"]

def test_run_dry_run_singular(fake_pipeline, capsys):
    analysis.run(None, ["MSFT"], days=365, max_filings=15, dry_run=True)
    assert "Would analyze 1 filing: 1 10-Q" in capsys.readouterr().out

def test_run_nothing_new_is_not_a_failure(fake_pipeline):
    # A company with no new filings is normal on most days, not an error
    assert analysis.run(None, ["OLD"], days=7, max_filings=15) == []
    assert fake_pipeline == []


@pytest.mark.parametrize(
    "argv, days, max_filings, dry_run",
    [
        (["AAPL"], 7, 15, False),
        (["AAPL", "--days", "365", "--max", "3", "--dry-run"], 365, 3, True),
    ],
)
def test_parse_args(argv, days, max_filings, dry_run):
    args = analysis.parse_args(argv)
    assert (args.days, args.max_filings, args.dry_run) == (days, max_filings, dry_run)

@pytest.mark.parametrize("argv", [[], ["AAPL", "--days", "0"], ["AAPL", "--max", "-1"]])
def test_parse_args_rejects(argv):
    # No tickers, or a window or cap below 1, is a usage error
    with pytest.raises(SystemExit):
        analysis.parse_args(argv)
