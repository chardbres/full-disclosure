-- Run once in the Supabase SQL editor. Safe to re-run.

-- One row per SEC filing. The accession number is the SEC's unique ID for a filing.
create table if not exists filings (
    accession_number text primary key,
    ticker text not null,
    cik integer not null,
    form text not null,
    filing_date date not null,
    url text not null
);

create index if not exists filings_ticker_idx on filings (ticker);

-- One row per Claude analysis. A filing can be re-analyzed later, e.g. with a newer model.
create table if not exists analyses (
    id bigint generated always as identity primary key,
    accession_number text not null references filings on delete cascade,
    model text not null,
    summary text not null,
    key_changes text[] not null,
    risks text[] not null,
    sentiment_score smallint not null check (sentiment_score between -5 and 5),
    sentiment_rationale text not null,
    created_at timestamptz not null default now()
);

create index if not exists analyses_accession_number_idx on analyses (accession_number);

-- Supabase exposes tables in the public schema through its REST API. The app connects
-- directly with psycopg instead, so turn on row-level security with no policies to
-- block that API. Direct connections as the postgres user are unaffected.
alter table filings enable row level security;
alter table analyses enable row level security;
