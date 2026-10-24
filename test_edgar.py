import pytest
from edgar import is_worth_summarizing, filing_url

@pytest.mark.parametrize(
    "filing, expected",
    [
        ({"form": "10-K", "items": ""}, True), # 10-K filings with no specific items are worth summarizing
        ({"form": "10-Q", "items": ""}, True), # 10-Q filings with no specific items are worth summarizing
        ({"form": "8-K", "items": "1.01"}, True), # 8-K filings with item 1.01 are worth summarizing
        ({"form": "8-K", "items": "2.02"}, True), # 8-K filings with item 2.02 are worth summarizing
        ({"form": "8-K", "items": "4.02"}, True), # 8-K filings with item 4.02 are worth summarizing
        ({"form": "8-K", "items": "5.02"}, True), # 8-K filings with item 5.02 are worth summarizing
        ({"form": "8-K", "items": "1.02"}, False), # 8-K filings with item 1.02 are not worth summarizing
        ({"form": "8-K", "items": "9.01"}, False), # 8-K filings with only item 9.01 are not worth summarizing
        ({"form": "8-K", "items": ""}, False), # 8-K filings with no items are not worth summarizing
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