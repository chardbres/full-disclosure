import os
import sys
from functools import cache

import requests
from dotenv import load_dotenv

TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'
SUBMISSIONS_URL =  'https://data.sec.gov/submissions/CIK{padded_cik}.json' 
WANTED_FORMS = {"10-K", "10-Q", "8-K"}
INTERESTING_ITEMS = {"1.01", "2.02", "4.02", "5.02"}

load_dotenv()

session = requests.Session()

def _user_agent() -> str:
    user_agent = os.environ.get('SEC_USER_AGENT')
    if not user_agent:
        raise RuntimeError("Set SEC_USER_AGENT to 'Your Name your@email.com' (required by the SEC)")
    return user_agent


@cache
def _load_ticker_map() -> dict[str, int]:
    response = session.get(TICKERS_URL, headers={'User-Agent': _user_agent()}, timeout=10)
    response.raise_for_status()
    return {info['ticker']: info['cik_str'] for info in response.json().values()}


def find_cik(ticker: str) -> int:
    normalized = ticker.strip().upper().replace('.', '-')
    try:
        return _load_ticker_map()[normalized]
    except KeyError:
        raise ValueError(f"Ticker {ticker} not found") from None


def padded_cik(cik: int) -> str:
    return f"{cik:010d}"

def get_submissions(cik: int) -> dict:
    url = SUBMISSIONS_URL.format(padded_cik=padded_cik(cik))
    response = session.get(url, headers={'User-Agent': _user_agent()}, timeout=10)
    response.raise_for_status()
    return response.json()


def get_filings(cik: int, since: str, forms: set[str] = WANTED_FORMS) -> list[dict]:
    recent = get_submissions(cik)["filings"]["recent"]
    filings = []
    for i in range(len(recent["form"])):
        if recent["form"][i] in forms and recent["filingDate"][i] >= since:
            filings.append({
                "form": recent["form"][i],
                "filing_date": recent["filingDate"][i],
                "accession_number": recent["accessionNumber"][i],
                "primary_document": recent["primaryDocument"][i],
                "items": recent["items"][i],
            })
    return filings


def is_worth_summarizing(filing: dict) -> bool:
    if filing["form"] in {"10-K", "10-Q"}:
        return True
    return bool(set(filing["items"].split(",")) & INTERESTING_ITEMS)

if __name__ == "__main__":
    my_ticker = sys.argv[1] if len(sys.argv) > 1 else 'AAPL'
    try:
        cik = find_cik(my_ticker)
        print(f"CIK: {cik}")

        for f in get_filings(cik, since="2026-01-01"):
            if is_worth_summarizing(f):
                print(f["filing_date"], f["form"], f["items"])
    except (ValueError, RuntimeError, requests.RequestException) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
