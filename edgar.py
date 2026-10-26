import os
import sys
from functools import cache

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{padded_cik}.json"
WANTED_FORMS = {"10-K", "10-Q", "8-K"}
INTERESTING_ITEMS = {"1.01", "1.02", "1.03", "1.05", "2.01", "2.02", "2.04", "2.05", "2.06", "3.01", "4.01", "4.02", "5.01","5.02"}

load_dotenv()

session = requests.Session()


def _user_agent() -> str:
    user_agent = os.environ.get("SEC_USER_AGENT")
    if not user_agent:
        raise RuntimeError(
            "Set SEC_USER_AGENT to 'Your Name your@email.com' (required by the SEC)"
        )
    return user_agent


@cache
def _load_ticker_map() -> dict[str, int]:
    response = session.get(
        TICKERS_URL, headers={"User-Agent": _user_agent()}, timeout=10
    )
    response.raise_for_status()
    return {info["ticker"]: info["cik_str"] for info in response.json().values()}


def find_cik(ticker: str) -> int:
    normalized = ticker.strip().upper().replace(".", "-")
    try:
        return _load_ticker_map()[normalized]
    except KeyError:
        raise ValueError(f"Ticker {ticker} not found") from None


def padded_cik(cik: int) -> str:
    return f"{cik:010d}"


def get_submissions(cik: int) -> dict:
    url = SUBMISSIONS_URL.format(padded_cik=padded_cik(cik))
    response = session.get(url, headers={"User-Agent": _user_agent()}, timeout=10)
    response.raise_for_status()
    return response.json()


def get_filings(cik: int, since: str, forms: set[str] = WANTED_FORMS) -> list[dict]:
    recent = get_submissions(cik)["filings"]["recent"]
    filings = []
    for i in range(len(recent["form"])):
        if recent["form"][i] in forms and recent["filingDate"][i] >= since:
            filings.append(
                {
                    "form": recent["form"][i],
                    "filing_date": recent["filingDate"][i],
                    "accession_number": recent["accessionNumber"][i],
                    "primary_document": recent["primaryDocument"][i],
                    "items": recent["items"][i],
                }
            )
    return filings


def filing_url(cik: int, accession_number: str, primary_document: str) -> str:
    accession_no_dashes = accession_number.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/{primary_document}"


def fetch_filing_html(url: str) -> str:
    response = session.get(url, headers={"User-Agent": _user_agent()}, timeout=30)
    response.raise_for_status()
    return response.text


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "ix:header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def find_exhibit_url(
    cik: int, accession_number: str, exhibit_type: str = "EX-99.1"
) -> str | None:
    accession_no_dashes = accession_number.replace("-", "")
    index_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/{accession_number}-index.htm"
    soup = BeautifulSoup(fetch_filing_html(index_url), "html.parser")
    for row in soup.select("table.tableFile tr"):
        cells = row.find_all("td")
        if len(cells) > 3 and cells[3].get_text(strip=True) == exhibit_type:
            link = cells[2].find("a")
            if link:
                return "https://www.sec.gov" + link["href"].removeprefix("/ix?doc=")
    return None


def get_filing_text(cik: int, filing: dict) -> str:
    url = filing_url(cik, filing["accession_number"], filing["primary_document"])
    text = html_to_text(fetch_filing_html(url))
    if filing["form"] == "8-K":
        # Earnings and other news 8-Ks often put the substance in the attached press release
        exhibit_url = find_exhibit_url(cik, filing["accession_number"])
        if exhibit_url:
            text += "\n\nEXHIBIT 99.1\n" + html_to_text(fetch_filing_html(exhibit_url))
    return text


def is_worth_summarizing(filing: dict) -> bool:
    if filing["form"] in {"10-K", "10-Q"}:
        return True
    return bool(set(filing["items"].split(",")) & INTERESTING_ITEMS)


if __name__ == "__main__":
    my_ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    try:
        cik = find_cik(my_ticker)
        print(f"CIK: {cik}")

        for f in get_filings(cik, since="2026-01-01"):
            if is_worth_summarizing(f):
                url = filing_url(cik, f["accession_number"], f["primary_document"])
                print(f["filing_date"], f["form"], url)
                html = fetch_filing_html(url)
                text = html_to_text(html)
                print(len(text), "characters of text")
                print(text[-2500:])
                break
    except (ValueError, RuntimeError, requests.RequestException) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
