from datetime import date

import pytest
import edgar
from edgar import is_worth_summarizing, filing_url, padded_cik, html_to_text, find_cik

@pytest.mark.parametrize(
    "filing, expected",
    [
        ({"form": "10-K", "items": ""}, True), # 10-K filings with no specific items are worth summarizing
        ({"form": "10-Q", "items": ""}, True), # 10-Q filings with no specific items are worth summarizing
        ({"form": "8-K", "items": "1.01"}, True), # entry into a material agreement
        ({"form": "8-K", "items": "1.02"}, True), # termination of a material agreement
        ({"form": "8-K", "items": "1.03"}, True), # bankruptcy or receivership
        ({"form": "8-K", "items": "1.05"}, True), # material cybersecurity incident
        ({"form": "8-K", "items": "2.01"}, True), # completed acquisition or disposition
        ({"form": "8-K", "items": "2.02"}, True), # results of operations
        ({"form": "8-K", "items": "2.04"}, True), # accelerated financial obligation
        ({"form": "8-K", "items": "2.05"}, True), # exit or disposal costs
        ({"form": "8-K", "items": "2.06"}, True), # material impairment
        ({"form": "8-K", "items": "3.01"}, True), # delisting notice
        ({"form": "8-K", "items": "4.01"}, True), # change of auditor
        ({"form": "8-K", "items": "4.02"}, True), # non-reliance on prior financials
        ({"form": "8-K", "items": "5.01"}, True), # change in control
        ({"form": "8-K", "items": "5.02"}, True), # officer or director changes
        ({"form": "8-K", "items": "2.02,9.01"}, True), # interesting item alongside exhibits
        ({"form": "8-K", "items": "7.01,1.03,9.01"}, True), # interesting item in the middle of the list
        ({"form": "8-K", "items": "7.01"}, False), # Reg FD disclosure
        ({"form": "8-K", "items": "8.01"}, False), # other events
        ({"form": "8-K", "items": "5.07"}, False), # shareholder vote results
        ({"form": "8-K", "items": "9.01"}, False), # exhibits only
        ({"form": "8-K", "items": "7.01,9.01"}, False), # several items, none interesting
        ({"form": "8-K", "items": ""}, False), # no items
    ]
)

def test_is_worth_summarizing(filing, expected):
    assert is_worth_summarizing(filing) == expected


@pytest.mark.parametrize(
    "cik, accession_number, primary_document, expected",
    [
        (123456, "0001234567-23-000001", "document.txt",
        "https://www.sec.gov/Archives/edgar/data/123456/000123456723000001/document.txt"),
        (987654, "0009876543-23-000002", "report.pdf", "https://www.sec.gov/Archives/edgar/data/987654/000987654323000002/report.pdf"),
    ]
)

def test_filing_url(cik, accession_number, primary_document, expected):
    assert filing_url(cik, accession_number, primary_document) == expected


@pytest.mark.parametrize(
        "cik, expected",
        [
            (123456, "0000123456"),
            (51143, "0000051143"),
            (123456789, "0123456789"),
            (1123456789, "1123456789"),
            (1, "0000000001")
        ]
)

def test_padded_cik(cik, expected):
    assert padded_cik(cik) == expected


def test_html_to_text():
    html = "<html><head><title>Test</title></head><body><h1>Hello</h1><p>This is a test.</p></body></html>"
    expected_text = "Test\nHello\nThis is a test."
    assert html_to_text(html) == expected_text

def test_html_to_text_removes_noise():
    html = (
        "<html><head><style>p {color: red}</style></head>"
        "<body><script>var x = 1;</script>"
        "<ix:header>hidden metadata</ix:header>"
        "<p>Visible text.</p></body></html>"
    )
    text = html_to_text(html)
    assert "Visible text." in text
    assert "color: red" not in text
    assert "var x" not in text
    assert "hidden metadata" not in text

# find_cik normally downloads the SEC's ticker map through _load_ticker_map.
# This fixture swaps in a small fake map so the tests run offline and don't
# depend on what the SEC's file contains today.
FAKE_TICKER_MAP = {"AAPL": 320193, "BRK-B": 1067983}

@pytest.fixture
def fake_ticker_map(monkeypatch):
    monkeypatch.setattr(edgar, "_load_ticker_map", lambda: FAKE_TICKER_MAP)


@pytest.mark.parametrize(
    "ticker, expected",
    [
        ("AAPL", 320193), # exact match
        ("aapl", 320193), # lowercase tickers are uppercased
        ("  AAPL\n", 320193), # surrounding whitespace is stripped
        ("BRK.B", 1067983), # the SEC writes share classes with a dash, so dots become dashes
        ("brk.b", 1067983), # lowercase and dot normalization together
    ]
)

def test_find_cik(fake_ticker_map, ticker, expected):
    assert find_cik(ticker) == expected

def test_find_cik_unknown_ticker(fake_ticker_map):
    # An unknown ticker raises ValueError (not KeyError) so callers can report it,
    # and the message shows the ticker exactly as the user typed it
    with pytest.raises(ValueError, match="Ticker zzzz not found"):
        find_cik("zzzz")


# The SEC rejects requests without a User-Agent that identifies the caller,
# so _user_agent should fail early with a helpful message instead.
# monkeypatch changes the environment only for the duration of each test.
def test_user_agent_returns_env_value(monkeypatch):
    monkeypatch.setenv("SEC_USER_AGENT", "Jane Doe jane@example.com")
    assert edgar._user_agent() == "Jane Doe jane@example.com"

def test_user_agent_missing(monkeypatch):
    monkeypatch.delenv("SEC_USER_AGENT", raising=False) # raising=False: fine if it's already unset
    with pytest.raises(RuntimeError, match="SEC_USER_AGENT"):
        edgar._user_agent()

def test_user_agent_empty(monkeypatch):
    # An empty value is treated the same as a missing one
    monkeypatch.setenv("SEC_USER_AGENT", "")
    with pytest.raises(RuntimeError, match="SEC_USER_AGENT"):
        edgar._user_agent()


# get_filings reads the "recent" filings from get_submissions, which normally
# calls the SEC API. The SEC stores filings as parallel lists: index i in each
# list describes the same filing. This fake has four filings in that layout.
FAKE_SUBMISSIONS = {
    "filings": {
        "recent": {
            "form": ["8-K", "10-Q", "4", "10-K"],
            "filingDate": ["2026-03-01", "2026-01-01", "2026-02-15", "2025-12-31"],
            "accessionNumber": ["0000000001-26-000003", "0000000001-26-000002", "0000000001-26-000004", "0000000001-25-000001"],
            "primaryDocument": ["ek.htm", "q.htm", "form4.xml", "k.htm"],
            "items": ["2.02,9.01", "", "", ""],
        }
    }
}

@pytest.fixture
def fake_submissions(monkeypatch):
    monkeypatch.setattr(edgar, "get_submissions", lambda cik: FAKE_SUBMISSIONS)


def test_get_filings_filters_by_form_and_date(fake_submissions):
    filings = edgar.get_filings(1, since="2026-01-01")
    # The Form 4 is dropped because it isn't a wanted form, and the 10-K is
    # dropped because it was filed before the cutoff. The 10-Q filed exactly on
    # the cutoff date is kept, because the comparison is inclusive.
    assert [f["form"] for f in filings] == ["8-K", "10-Q"]

def test_get_filings_maps_fields(fake_submissions):
    # The SEC's camelCase field names are converted to snake_case keys
    filing = edgar.get_filings(1, since="2026-01-01")[0]
    assert filing == {
        "form": "8-K",
        "filing_date": "2026-03-01",
        "accession_number": "0000000001-26-000003",
        "primary_document": "ek.htm",
        "items": "2.02,9.01",
    }

def test_get_filings_custom_forms(fake_submissions):
    # Passing forms overrides the default set of 10-K, 10-Q and 8-K
    filings = edgar.get_filings(1, since="2025-01-01", forms={"10-K"})
    assert [f["form"] for f in filings] == ["10-K"]

def test_get_filings_none_match(fake_submissions):
    # A cutoff after every filing date gives an empty list rather than an error
    assert edgar.get_filings(1, since="2027-01-01") == []


def test_filings_to_analyze_window(fake_submissions):
    # 60 days before 2026-03-02 is 2026-01-01, so the 10-Q filed that day is
    # included and the 10-K from the day before is not
    filings = edgar.filings_to_analyze(1, days=60, today=date(2026, 3, 2))
    assert [f["form"] for f in filings] == ["8-K", "10-Q"]

def test_filings_to_analyze_newest_first(monkeypatch):
    # Sorted by filing date even if the SEC's list isn't
    monkeypatch.setattr(edgar, "get_filings", lambda cik, since: [
        {"form": "10-Q", "filing_date": "2026-01-10", "items": ""},
        {"form": "10-K", "filing_date": "2026-02-20", "items": ""},
        {"form": "8-K", "filing_date": "2026-02-01", "items": "2.02"},
    ])
    filings = edgar.filings_to_analyze(1, days=365, today=date(2026, 3, 1))
    assert [f["filing_date"] for f in filings] == ["2026-02-20", "2026-02-01", "2026-01-10"]

def test_filings_to_analyze_skips_routine_8k(monkeypatch):
    # An 8-K with only routine items, like Regulation FD, isn't worth analyzing
    monkeypatch.setattr(edgar, "get_filings", lambda cik, since: [
        {"form": "8-K", "filing_date": "2026-02-01", "items": "7.01,9.01"},
        {"form": "10-Q", "filing_date": "2026-01-10", "items": ""},
    ])
    filings = edgar.filings_to_analyze(1, days=365, today=date(2026, 3, 1))
    assert [f["form"] for f in filings] == ["10-Q"]

def test_filings_to_analyze_passes_cutoff(monkeypatch):
    # The cutoff sent to get_filings is `days` before today, as YYYY-MM-DD
    seen = {}
    def fake_get_filings(cik, since):
        seen["since"] = since
        return []
    monkeypatch.setattr(edgar, "get_filings", fake_get_filings)
    edgar.filings_to_analyze(1, days=7, today=date(2026, 3, 1))
    assert seen["since"] == "2026-02-22"


# find_exhibit_url downloads a filing's index page and looks through its
# document table for an exhibit. These helpers build a fake index page with the
# same table layout EDGAR uses: Seq, Description, Document (link), Type, Size.
def index_row(href, exhibit_type):
    return (
        f"<tr><td>1</td><td>desc</td><td><a href=\"{href}\">doc</a></td>"
        f"<td>{exhibit_type}</td><td>100</td></tr>"
    )

def index_page(*rows):
    # The header row uses <th> cells, so the function has to skip it
    header = "<tr><th>Seq</th><th>Description</th><th>Document</th><th>Type</th><th>Size</th></tr>"
    return f"<table class=\"tableFile\">{header}{''.join(rows)}</table>"

@pytest.fixture
def fake_index(monkeypatch):
    # Returns a function that sets the page fetch_filing_html will return.
    # Every requested URL is recorded so tests can check which page was fetched.
    requested = []
    def set_page(html):
        def fake_fetch(url):
            requested.append(url)
            return html
        monkeypatch.setattr(edgar, "fetch_filing_html", fake_fetch)
        return requested
    return set_page


def test_find_exhibit_url_builds_index_url(fake_index):
    requested = fake_index(index_page())
    edgar.find_exhibit_url(320193, "0000320193-26-000005")
    # The folder name drops the dashes, but the index file name keeps them
    assert requested == [
        "https://www.sec.gov/Archives/edgar/data/320193/000032019326000005/0000320193-26-000005-index.htm"
    ]

def test_find_exhibit_url_found(fake_index):
    fake_index(index_page(
        index_row("/Archives/edgar/data/1/main.htm", "8-K"),
        index_row("/Archives/edgar/data/1/ex991.htm", "EX-99.1"),
    ))
    # The relative link from the page becomes a full sec.gov URL
    assert edgar.find_exhibit_url(1, "0000000001-26-000001") == "https://www.sec.gov/Archives/edgar/data/1/ex991.htm"

def test_find_exhibit_url_strips_inline_xbrl_viewer(fake_index):
    # Inline XBRL documents link through the /ix?doc= viewer. The prefix is
    # removed so the URL points at the raw document instead of the viewer.
    fake_index(index_page(index_row("/ix?doc=/Archives/edgar/data/1/ex991.htm", "EX-99.1")))
    assert edgar.find_exhibit_url(1, "0000000001-26-000001") == "https://www.sec.gov/Archives/edgar/data/1/ex991.htm"

def test_find_exhibit_url_other_exhibit_type(fake_index):
    # exhibit_type picks which exhibit to look for, so EX-99.1 is ignored here
    fake_index(index_page(
        index_row("/Archives/edgar/data/1/ex991.htm", "EX-99.1"),
        index_row("/Archives/edgar/data/1/ex101.htm", "EX-10.1"),
    ))
    assert edgar.find_exhibit_url(1, "0000000001-26-000001", "EX-10.1") == "https://www.sec.gov/Archives/edgar/data/1/ex101.htm"

def test_find_exhibit_url_not_found(fake_index):
    # Many 8-Ks have no press release attached
    fake_index(index_page(index_row("/Archives/edgar/data/1/main.htm", "8-K")))
    assert edgar.find_exhibit_url(1, "0000000001-26-000001") is None

def test_find_exhibit_url_skips_short_rows_and_missing_links(fake_index):
    # Rows with fewer than four cells are skipped instead of raising IndexError,
    # and a matching row with no link is skipped instead of raising TypeError
    fake_index(index_page(
        "<tr><td>only</td><td>two cells</td></tr>",
        "<tr><td>1</td><td>desc</td><td>no link here</td><td>EX-99.1</td></tr>",
    ))
    assert edgar.find_exhibit_url(1, "0000000001-26-000001") is None


# get_filing_text downloads the main document and, for 8-Ks only, appends the
# Exhibit 99.1 press release. Both the download and the exhibit lookup are
# replaced so these tests check just that decision.
MAIN_URL = "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/main.htm"
EXHIBIT_URL = "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/ex991.htm"
FAKE_PAGES = {
    MAIN_URL: "<p>Main document.</p>",
    EXHIBIT_URL: "<p>Press release.</p>",
}

@pytest.fixture
def fake_documents(monkeypatch):
    # Returns a function that sets what find_exhibit_url should return.
    # Its calls are recorded so tests can check whether it was used at all.
    exhibit_lookups = []
    def set_exhibit(exhibit_url):
        def fake_find_exhibit_url(cik, accession_number):
            exhibit_lookups.append(accession_number)
            return exhibit_url
        monkeypatch.setattr(edgar, "find_exhibit_url", fake_find_exhibit_url)
        return exhibit_lookups
    monkeypatch.setattr(edgar, "fetch_filing_html", lambda url: FAKE_PAGES[url])
    return set_exhibit

def make_filing(form):
    return {"form": form, "accession_number": "0000000001-26-000001", "primary_document": "main.htm"}


def test_get_filing_text_8k_with_exhibit(fake_documents):
    fake_documents(EXHIBIT_URL)
    # The press release follows the main text under a heading Claude can recognize
    assert edgar.get_filing_text(1, make_filing("8-K")) == "Main document.\n\nEXHIBIT 99.1\nPress release."

def test_get_filing_text_8k_without_exhibit(fake_documents):
    fake_documents(None)
    # With no press release attached, only the main document is returned
    assert edgar.get_filing_text(1, make_filing("8-K")) == "Main document."

@pytest.mark.parametrize("form", ["10-K", "10-Q"])
def test_get_filing_text_periodic_report_skips_exhibit(fake_documents, form):
    exhibit_lookups = fake_documents(EXHIBIT_URL)
    # 10-Ks and 10-Qs carry their substance in the main document, so the
    # index page isn't fetched at all (saving a request to the SEC)
    assert edgar.get_filing_text(1, make_filing(form)) == "Main document."
    assert exhibit_lookups == []
