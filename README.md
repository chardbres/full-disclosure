# Full Disclosure

Full Disclosure pulls 10-K, 10-Q and 8-K filings from SEC EDGAR for a
watchlist of companies and has Claude summarize each one: what changed, the
biggest risks and the overall tone for investors. A Next.js site publishes the
results.

## How it fits together

- **Pipeline** (Python, this folder): `edgar.py` finds each company's recent
  filings and keeps the ones worth reading. `analysis.py` sends the filing text
  to Claude for structured output and saves the result to Postgres through
  `db.py`.
- **Schedule:** a GitHub Actions workflow
  ([`analyze.yml`](.github/workflows/analyze.yml)) runs the pipeline every day
  over [`watchlist.txt`](watchlist.txt). It analyzes every filing worth
  summarizing from the past 7 days, and skips filings already in the database.
- **Database:** Postgres on Supabase. [`schema.sql`](schema.sql) creates the
  tables. [`reader.sql`](reader.sql) creates the read-only login the website
  uses.
- **Website** ([`web/`](web)): Next.js and TypeScript, deployed on Vercel.
  It lists every analysis, and each company has a page with its analyses and
  its recent EDGAR filings. Search suggests companies from the SEC's full
  list. Pages are cached for an hour, so new analyses appear without a
  redeploy.

## Running the pipeline locally

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in the values
.venv/bin/python analysis.py AAPL MSFT
.venv/bin/pytest
```

`analysis.py` takes these options:

- `--days N`: how many days back to look for filings. The default is 7.
- `--max N`: the most filings to analyze in one run. The default is 15. A run
  that reaches the limit lists the filings it left, and the next run picks
  them up.
- `--dry-run`: list the filings that would be analyzed, without calling Claude
  or saving anything.

For example, to see what a year of Nvidia's filings would involve:

```sh
.venv/bin/python analysis.py --days 365 --dry-run NVDA
```

## Running the website locally

```sh
cd web
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

## Deploying

1. Run `schema.sql`, then `reader.sql`, in the Supabase SQL editor.
2. Add `SEC_USER_AGENT`, `ANTHROPIC_API_KEY` and `DATABASE_URL` (the main
   login, which can write) as repository secrets in GitHub, under Settings →
   Secrets and variables → Actions.
3. Import the repo into Vercel with `web` as the root directory. Set
   `DATABASE_URL` to the read-only `fd_reader` login on the transaction pooler
   (port 6543), and set `SEC_USER_AGENT`.

## Design notes

- The CIK lookup is cached, so the SEC's ticker list is downloaded once per
  run.
- A `requests.Session` keeps the connection to the SEC open between calls,
  instead of a new connection and handshake each time.

---

© Rick Bresnahan. All rights reserved. The code is shared for viewing; no
license is granted to use, copy or distribute it.
