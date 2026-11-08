import { formatScore, sentimentLabel, sentimentTone } from "@/lib/format";

const SWATCH = {
  negative: "bg-negative",
  neutral: "bg-neutral",
  positive: "bg-positive",
};

// The colored square carries the tone. The score and label stay in text
// colors so they read the same for everyone.
export default function SentimentBadge({
  score,
  showLabel = true,
}: {
  score: number;
  showLabel?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className={`size-2.5 rounded-sm ${SWATCH[sentimentTone(score)]}`} />
      <span className="w-6 font-semibold text-ink tabular-nums">{formatScore(score)}</span>
      {showLabel && <span className="text-muted">{sentimentLabel(score)}</span>}
    </span>
  );
}
