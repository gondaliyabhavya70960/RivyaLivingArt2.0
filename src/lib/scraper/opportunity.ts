/**
 * The opportunity score (B8, plan §4 phase 8) — one row per COMPONENT,
 * because rule 7 is absolute: every automated recommendation is explainable,
 * so we show the components, not a score.
 *
 * "Opportunity" here answers the owner's actual question: which shortlisted
 * competitor pieces look like markets worth entering. The components are
 * deliberately few, plain, and measurable from what the corpus already knows
 * — no AI inference, no invented demand signal:
 *
 *   market-depth    How many comparable competitor designs the league
 *                   benchmark stands on. A deep benchmark is a proven
 *                   market; a league with three listings is a guess.
 *   price-fit       How close the piece's reference price sits to its
 *                   league's median. Rivya competes on comparable pieces;
 *                   a price three times off the median in either direction
 *                   is a different market, not an opportunity in this one.
 *   freshness       How recently the piece was seen still listed. A listing
 *                   that keeps reappearing under re-scrape is alive; one not
 *                   seen for 90+ days may be gone, and the score decays to 0.
 *   option-richness How many comparable variants the latest snapshot showed.
 *                   A configurable, developed product line scores; a single
 *                   implicit row does not.
 *
 * Each component yields a value in [0,1] (or null when it cannot be
 * measured — a quote-only piece has no price fit, and the honest row says
 * so with contribution 0 rather than guessing), the named weight it
 * carried, and a `detail` string showing the working in words. The total a
 * reader might want is Σ contribution, computable from the rows — which is
 * exactly why no total is ever STORED: a stored total is a score with the
 * working thrown away.
 *
 * Pure module: no db, no fetch. Inputs are plain values so unit tests run
 * against literals.
 */

/** Bump ANALYTICS_VERSION (analytics.ts), not this file, when these change —
 *  the stamp lives there so one constant versions the whole analytics read. */
export const OPPORTUNITY_COMPONENTS = [
  "market-depth",
  "price-fit",
  "freshness",
  "option-richness",
] as const;
export type OpportunityComponent = (typeof OPPORTUNITY_COMPONENTS)[number];

/**
 * The named weights, summing to 1. Recorded on every stored row (per
 * component, per product), so re-weighting the formula is visible in the
 * data itself rather than a silent change to what a number means.
 */
export const OPPORTUNITY_WEIGHTS: Record<OpportunityComponent, number> = {
  "market-depth": 0.35,
  "price-fit": 0.35,
  freshness: 0.2,
  "option-richness": 0.1,
};

export const OPPORTUNITY_COMPONENT_LABELS: Record<OpportunityComponent, string> = {
  "market-depth": "Market depth",
  "price-fit": "Price fit",
  freshness: "Freshness",
  "option-richness": "Option richness",
};

export const OPPORTUNITY_COMPONENT_DESCRIPTIONS: Record<
  OpportunityComponent,
  string
> = {
  "market-depth":
    "How many comparable competitor designs the league benchmark stands on — full marks at 25.",
  "price-fit":
    "How close the piece's reference price sits to its league's unique-design median — full marks at the median, zero at 3× off.",
  freshness:
    "How recently the piece was seen still listed — decays to zero across 90 days.",
  "option-richness":
    "How many comparable variants the latest snapshot showed — full marks at 4.",
};

/** Full marks when the benchmark stands on this many designs. Below it the
 *  score scales linearly — 12 designs is half a market. */
export const MARKET_DEPTH_TARGET = 25;

/** A price this far from the league median (in either direction) scores 0 —
 *  3× off the median is a different market, not an opportunity in this one. */
export const PRICE_FIT_FALLOFF = 3;

/** Days over which freshness decays from 1 to 0. */
export const FRESHNESS_WINDOW_DAYS = 90;

/** Full marks when the latest snapshot shows this many comparable variants. */
export const OPTION_RICHNESS_TARGET = 4;

export type OpportunityInput = {
  /**
   * The piece's reference price in paise — B6's `pickReferenceVariant` over
   * the latest snapshot — or null when there is no comparable price (a
   * quote-only or unpriced piece).
   */
  referencePriceMinor: number | null;
  /** The piece's league's UNIQUE_DESIGN median, or null when the league has
   *  no benchmark yet. */
  benchmarkMedianMinor: number | null;
  /** How many designs the median stands on. */
  benchmarkDesigns: number;
  /** `ResearchProduct.lastSeen` — the last scrape that found it listed. */
  lastSeen: Date;
  /** Comparable (non-reference, priced, non-quote-only) variants on the
   *  latest snapshot. */
  comparableVariantCount: number;
  /** Injection point for "now", so tests are deterministic. */
  now: Date;
};

export type ScoredComponent = {
  component: OpportunityComponent;
  /** The measured value in [0,1]; null when unmeasurable (contribution 0). */
  value: number | null;
  weight: number;
  contribution: number;
  /** The working, in words — inputs, counts, and why. */
  detail: string;
};

/** Inr major-units formatter for detail strings (₹84,500). */
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function formatMajor(minor: number): string {
  return `₹${inr.format(minor / 100)}`;
}

function scoreMarketDepth(input: OpportunityInput): ScoredComponent {
  const value = Math.min(1, input.benchmarkDesigns / MARKET_DEPTH_TARGET);
  return {
    component: "market-depth",
    value,
    weight: OPPORTUNITY_WEIGHTS["market-depth"],
    contribution: value * OPPORTUNITY_WEIGHTS["market-depth"],
    detail:
      input.benchmarkDesigns === 0
        ? "No comparable designs in the league benchmark yet — an unproven market, not a deep one."
        : `${input.benchmarkDesigns} comparable design(s) in the league benchmark (unique-design scope); full marks at ${MARKET_DEPTH_TARGET}.`,
  };
}

function scorePriceFit(input: OpportunityInput): ScoredComponent {
  const weight = OPPORTUNITY_WEIGHTS["price-fit"];
  if (input.referencePriceMinor === null) {
    return {
      component: "price-fit",
      value: null,
      weight,
      contribution: 0,
      detail:
        "No comparable price — the piece is quote-only or unpriced, and a price fit is not guessed at.",
    };
  }
  if (
    input.benchmarkMedianMinor === null ||
    input.benchmarkMedianMinor <= 0
  ) {
    return {
      component: "price-fit",
      value: null,
      weight,
      contribution: 0,
      detail:
        "The league has no price benchmark yet, so there is no median to fit against.",
    };
  }
  const ratio = input.referencePriceMinor / input.benchmarkMedianMinor;
  const distance = Math.abs(Math.log(ratio));
  const value = Math.max(0, 1 - distance / Math.log(PRICE_FIT_FALLOFF));
  const pct = Math.round((ratio - 1) * 100);
  const direction =
    pct === 0 ? "at" : pct > 0 ? `${pct}% above` : `${-pct}% below`;
  return {
    component: "price-fit",
    value,
    weight,
    contribution: value * weight,
    detail: `${formatMajor(input.referencePriceMinor)} vs league median ${formatMajor(input.benchmarkMedianMinor)} across ${input.benchmarkDesigns} design(s) — ${direction} the median; zero at ${PRICE_FIT_FALLOFF}× off.`,
  };
}

function scoreFreshness(input: OpportunityInput): ScoredComponent {
  const days = Math.max(
    0,
    Math.floor((input.now.getTime() - input.lastSeen.getTime()) / 86_400_000),
  );
  const value = Math.max(0, 1 - days / FRESHNESS_WINDOW_DAYS);
  return {
    component: "freshness",
    value,
    weight: OPPORTUNITY_WEIGHTS.freshness,
    contribution: value * OPPORTUNITY_WEIGHTS.freshness,
    detail: `Last seen listed ${days} day(s) ago; a listing not seen for ${FRESHNESS_WINDOW_DAYS}+ days scores 0.`,
  };
}

function scoreOptionRichness(input: OpportunityInput): ScoredComponent {
  const value = Math.min(
    1,
    input.comparableVariantCount / OPTION_RICHNESS_TARGET,
  );
  return {
    component: "option-richness",
    value,
    weight: OPPORTUNITY_WEIGHTS["option-richness"],
    contribution: value * OPPORTUNITY_WEIGHTS["option-richness"],
    detail: `${input.comparableVariantCount} comparable variant(s) on the latest snapshot; full marks at ${OPTION_RICHNESS_TARGET}.`,
  };
}

/**
 * Score one product as its four components. The order is the display order.
 * Nothing here throws and nothing is skipped silently: an unmeasurable
 * component is a row with value null and contribution 0, not a missing row —
 * a reader comparing two products must see the same four lines on each.
 */
export function scoreOpportunity(input: OpportunityInput): ScoredComponent[] {
  return [
    scoreMarketDepth(input),
    scorePriceFit(input),
    scoreFreshness(input),
    scoreOptionRichness(input),
  ];
}

/**
 * Σ contribution — the ranking aid a reader can recompute from the rows,
 * which is precisely why it is never stored as a row of its own.
 */
export function opportunityTotal(components: ScoredComponent[]): number {
  return components.reduce((a, c) => a + c.contribution, 0);
}
