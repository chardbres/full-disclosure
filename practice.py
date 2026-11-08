import requests

def make_ticker_dict(tickers: list[str]) -> dict[str, int]:
    return {ticker: len(ticker) for ticker in tickers}

if __name__ == "__main__":
    print(make_ticker_dict(['AAPL', 'GOOGL', 'MSFT', 'IBM']))

response = requests.get('https://www.sec.gov/files/company_tickers.json', headers={'User-Agent': 'FullDisclosure you@example.com'}, timeout=10)

response.raise_for_status()
data = response.json()

print(type(data))
print(list(data.items())[:3])