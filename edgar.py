import requests
import sys

def find_cik(ticker: str) -> int:
    response = requests.get('https://www.sec.gov/files/company_tickers.json', headers={'User-Agent': 'Rick Bresnahan richard.m.bresnahan@gmail.com'}, timeout=10)

    response.raise_for_status()
    data = response.json()

    for index, info in data.items():
        if info['ticker'] == ticker:
            return info['cik_str']

    raise ValueError(f"Ticker {ticker} not found")

if __name__ == "__main__":
    my_ticker = sys.argv[1] if len(sys.argv) > 1 else 'AAPL'
    print(find_cik(my_ticker))