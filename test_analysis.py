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
