import os

import psycopg
from dotenv import load_dotenv

load_dotenv()


def connect() -> psycopg.Connection:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "Set DATABASE_URL to the Postgres connection string (see .env.example)"
        )
    # Autocommit, so each save_analysis is committed as soon as it finishes
    return psycopg.connect(database_url, autocommit=True)


def is_analyzed(conn: psycopg.Connection, accession_number: str) -> bool:
    row = conn.execute(
        "select exists (select 1 from analyses where accession_number = %s)",
        (accession_number,),
    ).fetchone()
    return row[0]


def save_analysis(
    conn: psycopg.Connection,
    ticker: str,
    cik: int,
    filing: dict,
    url: str,
    model: str,
    analysis: dict,
) -> None:
    # Both inserts succeed or neither does
    with conn.transaction():
        conn.execute(
            """
            insert into filings (accession_number, ticker, cik, form, filing_date, url)
            values (%s, %s, %s, %s, %s, %s)
            on conflict (accession_number) do nothing
            """,
            (
                filing["accession_number"],
                ticker.upper(),
                cik,
                filing["form"],
                filing["filing_date"],
                url,
            ),
        )
        conn.execute(
            """
            insert into analyses (
                accession_number, model, summary, key_changes, risks,
                sentiment_score, sentiment_rationale
            )
            values (
                %(accession_number)s, %(model)s, %(summary)s, %(key_changes)s,
                %(risks)s, %(sentiment_score)s, %(sentiment_rationale)s
            )
            """,
            {
                "accession_number": filing["accession_number"],
                "model": model,
                **analysis,
            },
        )
