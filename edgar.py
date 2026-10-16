import os
import sys
from functools import cache

import requests
from dotenv import load_dotenv

TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'

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


if __name__ == "__main__":
    load_dotenv()
    my_ticker = sys.argv[1] if len(sys.argv) > 1 else 'AAPL'
    try:
        print(find_cik(my_ticker))
    except (ValueError, RuntimeError, requests.RequestException) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
