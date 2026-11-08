export function formatDate(isoDate: string): string {
  // Dates come from Postgres as YYYY-MM-DD. Parse them as UTC so the day
  // doesn't shift with the server's time zone.
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export type Tone = "negative" | "neutral" | "positive";

export function sentimentTone(score: number): Tone {
  if (score < 0) return "negative";
  if (score > 0) return "positive";
  return "neutral";
}

export function sentimentLabel(score: number): string {
  if (score <= -3) return "Negative";
  if (score < 0) return "Leans negative";
  if (score === 0) return "Neutral";
  if (score < 3) return "Leans positive";
  return "Positive";
}

export const FORM_DESCRIPTIONS: Record<string, string> = {
  "10-K": "Annual report",
  "10-Q": "Quarterly report",
  "8-K": "Current report",
};
