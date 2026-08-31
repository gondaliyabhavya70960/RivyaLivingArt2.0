import Link from "next/link";

import { cn } from "@/lib/utils";

/* §12.5 keeps the elevation tiers the storefront gives up — e1 is the Studio's
   resting card, and the hairline does the rest of the separating work. */
const CARD_CLASS =
  "flex min-h-[10.5rem] flex-col rounded-card border border-border bg-card p-5 shadow-e1";

export type StatDelta = {
  /** Pre-formatted, e.g. "+18% vs last week". */
  label: string;
  tone: "up" | "down" | "flat";
};

const DELTA_TONE: Record<StatDelta["tone"], string> = {
  // Status inks, not the action colour — the studio dark scope re-points
  // success/alert for AA on obsidian.
  up: "text-success",
  down: "text-alert",
  flat: "text-graphite",
};

/**
 * §12.3's "one hairline sparkline each". Deliberately a 1px stroke with no
 * fill, no dots and no axis: at 20px tall it is a texture that says "rising",
 * "flat" or "falling", and the mono numeral above it carries the actual value.
 * `aria-hidden` for the same reason — the number is the content. It is drawn
 * in graphite, not champagne: champagne is the active-item marker in this
 * Studio and four of them in one viewport would break the two-per-viewport
 * rule (contract §2) on the very first screen.
 *
 * A series that is entirely zero draws a flat baseline rather than nothing, so
 * a quiet month reads as "measured and quiet", not "broken".
 */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const path = points
    .map(
      (value, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(19 - (value / max) * 18).toFixed(2)}`,
    )
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      className="mt-4 h-5 w-full text-graphite/70"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCardBody({
  label,
  value,
  delta,
  note,
  spark,
}: {
  label: string;
  value: string;
  delta?: StatDelta;
  note?: string;
  spark?: number[];
}) {
  return (
    <>
      <p className="u-micro">{label}</p>
      <p className="u-num mt-3 text-[2.75rem] leading-none text-foreground">
        {value}
      </p>
      {delta && (
        <p className={cn("u-num mt-2 text-small", DELTA_TONE[delta.tone])}>
          {delta.label}
        </p>
      )}
      {note && (
        <p className="mt-2 text-small leading-snug text-graphite">{note}</p>
      )}
      <div className="mt-auto">
        {spark ? (
          <Sparkline points={spark} />
        ) : (
          // No series behind this metric — a hairline rule holds the card's
          // baseline rather than a fabricated trend.
          <div aria-hidden className="mt-4 h-5 border-b border-border" />
        )}
      </div>
    </>
  );
}

/**
 * §12.3 KPI card. Large mono numerals, one hairline sparkline each, no icon
 * chip — a grid of boxed glyphs is the "generic admin template" §12.2 asks
 * this Studio not to be, and Part 3.7 keeps icons out of proof blocks.
 *
 * Pass `href` to make the whole card a link; sapphire stays the only action
 * colour, so hover is a border shift, never a fill.
 */
export function StatCard({
  label,
  value,
  href,
  delta,
  note,
  spark,
}: {
  label: string;
  /** Pre-formatted so callers control locale/percent rendering. */
  value: string;
  href?: string;
  /** vs-previous-period line under the numeral. */
  delta?: StatDelta;
  /** One line of plain-language context (what exactly is being counted). */
  note?: string;
  /** Daily counts for the hairline sparkline; omit when no series exists. */
  spark?: number[];
}) {
  const body = (
    <StatCardBody
      label={label}
      value={value}
      delta={delta}
      note={note}
      spark={spark}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          CARD_CLASS,
          "outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-sapphire-ink/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={CARD_CLASS}>{body}</div>;
}
