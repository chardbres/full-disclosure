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
// first. Throws if EDGAR can't be reached, so a failure isn't cached.
export const getRecentFilings = async (cik: number, days = 365): Promise<EdgarFiling[]> => {
  "use cache";
  cacheLife("hours");

  const response = await fetch(SUBMISSIONS_URL.replace("{cik}", String(cik).padStart(10, "0")), {
    headers: { "User-Agent": process.env.SEC_USER_AGENT ?? "" },
    signal: AbortSignal.timeout(SEC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`EDGAR returned ${response.status}`);
  const { recent } = ((await response.json()) as Submissions).filings;

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
