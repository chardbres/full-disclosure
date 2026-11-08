import { formatScore, sentimentLabel } from "@/lib/format";

const STEPS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

const FILL = { negative: "bg-negative", positive: "bg-positive" };
const TRACK = { negative: "bg-negative-soft", positive: "bg-positive-soft" };

// A diverging bar from -5 to +5. Segments fill outward from zero to the
// score, in red below zero and blue above it.
export default function SentimentScale({ score }: { score: number }) {
  const label = sentimentLabel(score);
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-semibold tracking-tight text-ink">
          {formatScore(score)}
        </span>
        <span className="text-base font-medium text-ink-2">{label}</span>
      </div>
      <div
        role="img"
        aria-label={`Sentiment ${formatScore(score)} on a scale from −5 to +5: ${label}`}
        className="mt-5"
      >
        <div className="flex items-center gap-0.5">
          {STEPS.map((step) => {
            const side = step < 0 ? "negative" : "positive";
            const filled = step < 0 ? score <= step : score >= step;
            return (
              <div
                key={step}
                className={`h-3 flex-1 first:rounded-l last:rounded-r ${filled ? FILL[side] : TRACK[side]}`}
              />
            );
          })}
        </div>
        <div
          aria-hidden
          className="mt-2 flex justify-between text-xs text-muted tabular-nums"
        >
          <span>−5 Negative</span>
          <span>0</span>
          <span>Positive +5</span>
        </div>
      </div>
    </div>
  );
}
