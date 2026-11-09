import "server-only";
import { cacheLife } from "next/cache";
import { SEC_TIMEOUT_MS } from "./companies";
import type { Form } from "./data";

const SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json";

// Which filings are worth summarizing. These rules match edgar.py in the
// pipeline: keep the two in step.
const FORMS = new Set(["10-K", "10-Q", "8-K"]);
const MATERIAL_8K_ITEMS = new Set([
  "1.01", "1.02", "1.03", "1.05", "2.01", "2.02", "2.04",
  "2.05", "2.06", "3.01", "4.01", "4.02", "5.01", "5.02",
]);

export interface EdgarFiling {
  accessionNumber: string;
  form: Form;
  filingDate: string;
  url: string;
}

// The SEC lists filings as parallel arrays: index i in each describes one filing
interface Submissions {
  filings: {
    recent: {
      accessionNumber: string[];
      form: string[];
      filingDate: string[];
      primaryDocument: string[];
      items: string[];
    };
  };
}

// A company's filings worth summarizing from the last `days` days, newest
// first, or null if EDGAR can't be reached. It returns null rather than
// throwing, because an error inside a cached function fails the build. A
// failure is kept only briefly, so the next visit tries again.
export const getRecentFilings = async (
  cik: number,
  days = 365,
): Promise<EdgarFiling[] | null> => {
  "use cache";

  let submissions: Submissions;
  try {
    const response = await fetch(
      SUBMISSIONS_URL.replace("{cik}", String(cik).padStart(10, "0")),
      {
        headers: { "User-Agent": process.env.SEC_USER_AGENT ?? "" },
        signal: AbortSignal.timeout(SEC_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`EDGAR returned ${response.status}`);
    submissions = await response.json();
  } catch {
    cacheLife("minutes");
    return null;
  }
  cacheLife("hours");

  const { recent } = submissions.filings;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return recent.form
    .map((form, i) => ({ form, i }))
    .filter(
      ({ form, i }) =>
        FORMS.has(form) &&
        recent.filingDate[i] >= since &&
        (form !== "8-K" || recent.items[i].split(",").some((item) => MATERIAL_8K_ITEMS.has(item))),
    )
    .map(({ form, i }) => ({
      accessionNumber: recent.accessionNumber[i],
      form: form as Form,
      filingDate: recent.filingDate[i],
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${recent.accessionNumber[i].replaceAll("-", "")}/${recent.primaryDocument[i]}`,
    }))
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate));
};
