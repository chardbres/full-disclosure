# Website functions

Every top-level function in the website, grouped by folder, with what it does.
There are 43.

- **`app/`**: routes. Next.js finds each page by its folder and calls it by
  name.
- **`components/`**: pieces of the interface.
- **`lib/`**: data and helpers. Everything that talks to the database or the
  SEC lives here.

Functions marked **cached** start with `"use cache"`. Next.js saves the result
and reuses it until the time in `cacheLife` runs out ("hours" is about an hour,
"days" is about a day). Pages that use them load without a database call or SEC
request most of the time.

## lib/: data and helpers

### lib/db.ts

| Function | What it does |
|---|---|
| `db` | Returns the shared Postgres connection, opening it on first use. It uses one connection that sends one query at a time, because Supabase's transaction pooler hangs on queued queries. |

### lib/data.ts

| Function | What it does |
|---|---|
| `latestAnalyses` | A SQL fragment that picks the newest analysis of each filing, since a filing can be analyzed more than once. The queries below build on it. |
| `withNames` | Adds each row's company name from the SEC's list. The database stores only tickers. |
| `getFilings` | **Cached.** Every analyzed filing, newest first, with its summary and sentiment. Feeds the home page table and stats. |
| `getFiling` | **Cached.** One filing's full analysis (summary, key changes, risks, sentiment and details) for its page. |
| `getRecentAccessionNumbers` | **Cached.** The 50 newest filings' IDs, which tells Next.js which filing pages to build ahead of time. |
| `getCompany` | Everything a company page shows: its name, its analyzed filings and its recent EDGAR filings. It finds companies in the SEC's list or the database, so a page still works if one of them is unavailable. |

### lib/companies.ts

| Function | What it does |
|---|---|
| `displayName` | Tidies SEC company names, so "BERKSHIRE HATHAWAY INC /DE/" becomes "Berkshire Hathaway Inc". |
| `fetchCompanies` | Downloads the SEC's list of about 10,000 companies (ticker, CIK and name). It gives up after 5 seconds and returns nothing on failure, so pages fall back to tickers. |
| `getCompanies` | **Cached.** The SEC list keyed by ticker. Pages rendered at the same moment share one download, so a build doesn't trip the SEC's rate limit. |
| `searchCompanies` | The best matches for a search, ranked: the exact ticker, then tickers starting with the text, then names starting with it, then names containing a word that starts with it. |

### lib/edgar.ts

| Function | What it does |
|---|---|
| `getRecentFilings` | **Cached.** A company's filings worth summarizing from the past year, read from EDGAR. Its rules match the pipeline's `edgar.py`. It throws when EDGAR can't be reached, so the failure isn't cached and the page says so. |

### lib/format.ts

| Function | What it does |
|---|---|
| `formatDate` | "2026-11-03" to "Nov 3, 2026". Parsed as UTC so the day can't shift with the server's time zone. |
| `formatScore` | A sentiment score with its sign, so 3 becomes "+3". |
| `sentimentTone` | A score's tone: negative, neutral or positive. It picks the badge color. |
| `sentimentLabel` | A score in words, from "Negative" to "Positive". |
| `tickerKey` | Puts a ticker in the SEC's form, so "brk.b" becomes "BRK-B". It's used for matching and for company page addresses. |

## app/: routes

### app/layout.tsx

| Function | What it does |
|---|---|
| `RootLayout` | The frame around every page: fonts, header, main area and footer. |

### app/page.tsx (/)

| Function | What it does |
|---|---|
| `Home` | The home page: headline, stat tiles and the filings table. |

### app/about/page.tsx (/about)

| Function | What it does |
|---|---|
| `AboutPage` | How the pipeline works, what it's built with and its limits. |

### app/not-found.tsx

| Function | What it does |
|---|---|
| `NotFound` | The "Page not found" page, shown for unknown addresses, filings and tickers. |

### app/filings/[accession]/page.tsx (/filings/0000320193-26-000101)

| Function | What it does |
|---|---|
| `findFiling` | Checks that the ID looks like an SEC accession number before querying, so junk addresses never reach the database. |
| `generateStaticParams` | Tells Next.js which filing pages to build ahead of time: the 50 newest. Others are built on first visit. |
| `generateMetadata` | The browser tab title and search-engine description, such as "AAPL 10-K, filed Nov 3, 2026". |
| `FilingPage` | The page shell: the back link, with the details loading inside a `Suspense` boundary. |
| `FilingDetails` | Loads the filing and lays out its header, summary, sentiment, details, key changes and risks. |
| `Section` | A white card with a heading, used for each block on the filing page. |
| `NumberedList` | The numbered lists of key changes and risks, with a message when a list is empty. |

### app/companies/[ticker]/page.tsx (/companies/NVDA)

| Function | What it does |
|---|---|
| `findCompany` | Checks that the ticker looks valid before looking it up. |
| `generateStaticParams` | Builds pages ahead of time for companies that have analyses. Others are built on first visit. |
| `generateMetadata` | The tab title and description, such as "Nvidia Corp (NVDA) filings", plus the canonical address. |
| `CompanyPage` | The page shell: the back link, with the details inside a `Suspense` boundary. |
| `CompanyDetails` | The company header, its analyzed filings and its recent EDGAR filings, each marked analyzed or not. |

### app/api/companies/route.ts (/api/companies?q=…)

| Function | What it does |
|---|---|
| `GET` | Returns up to 8 matching companies as JSON for the search box. Vercel's CDN caches answers for a day. |

## components/: interface pieces

| Function | What it does |
|---|---|
| `SiteHeader` | The logo and the Filings, About and GitHub links. |
| `SiteFooter` | The disclaimer ("not investment advice") and the credit. |
| `StatTile` | One labeled number on the home page, such as "Filings analyzed: 11". |
| `FilingTable` | The home page table, with search and the 10-K, 10-Q and 8-K filter. On phones each row becomes a card. |
| `matches` | Whether a filing matches the search text, by ticker or company name. Used by `FilingTable`. |
| `CompanySearch` | The search box. It filters the table as you type and suggests companies from `/api/companies`. Choosing one, or pressing Enter on an exact ticker, opens the company page. It supports the arrow keys, Enter and Escape. |
| `FormBadge` | The small "10-K" label. Hovering shows what the form is. |
| `SentimentBadge` | A colored square, the score and a word, such as "+2 Leans positive". The words carry the meaning, so color isn't needed to read it. |
| `SentimentScale` | The −5 to +5 bar on the filing page, filled from zero toward the score. |
