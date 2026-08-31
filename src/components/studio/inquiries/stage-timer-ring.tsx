import { cn } from "@/lib/utils";

import type { StageTimer } from "@/components/studio/inquiries/lead-time";

const RING_TONE: Record<StageTimer["band"], string> = {
  within: "text-sapphire-ink",
  "beyond-small": "text-warning",
  "beyond-statement": "text-alert",
};

const CIRCUMFERENCE = 2 * Math.PI * 15;

/**
 * §12.4's "circular progress ring" stage-timer badge.
 *
 * The arc is days-in-pipeline against the published 3–6 week statement-piece
 * ceiling; the numeral inside is the day count. See `lead-time.ts` for why it
 * measures that rather than the spec's `Layer 2 · 48 of 72 h` — there is no
 * layer or cure tracking in the schema to read.
 *
 * The whole badge is one labelled `img`: the arc and the numeral are two views
 * of the same fact, and reading "36 · circle · 36" aloud helps nobody.
 */
export function StageTimerRing({ timer }: { timer: StageTimer }) {
  const dash = CIRCUMFERENCE * timer.progress;

  return (
    <span
      role="img"
      aria-label={timer.description}
      title={timer.description}
      className={cn(
        "relative inline-flex size-10 shrink-0",
        RING_TONE[timer.band],
      )}
    >
      <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
        />
      </svg>
      <span
        aria-hidden
        className="u-num absolute inset-0 flex items-center justify-center text-12 text-foreground"
      >
        {timer.days}
      </span>
    </span>
  );
}
