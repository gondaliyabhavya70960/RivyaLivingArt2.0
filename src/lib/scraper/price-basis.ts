/**
 * What a scraped price MEANS (workstream B, phase 6b).
 *
 * Until this existed every price was an integer or nothing, and the two
 * failure modes were indistinguishable:
 *
 *   - a bespoke studio that quotes on enquiry and publishes no number, and
 *   - a priced product whose price the adapter failed to parse.
 *
 * Both arrive as `priceMin: undefined`, and every adapter hardcodes
 * `showPrice: true`. Downstream that becomes a zero or a silent omission —
 * which is the plan's "quote-only is not free" rule, stated as a defect.
 *
 * So each variant carries a basis, and `QUOTE_ONLY` carries a NULL price
 * rather than a zero. Aggregates exclude it by clause (`priceBasis <>
 * 'QUOTE_ONLY'`), never by filtering zeros — a zero that means "no price" is
 * indistinguishable from a zero that means "free", and one of those is a real
 * thing a supplier can publish.
 *
 * Pure module: no database, no network. The signals are deliberately
 * conservative — a phrase has to be unambiguous to move a product off the
 * default, because guessing PER_AREA on a coaster would corrupt exactly the
 * comparison this exists to protect.
 */

export const PRICE_BASES = [
  "PER_PIECE",
  "PER_AREA",
  "STARTING_FROM",
  "QUOTE_ONLY",
] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

/** Short display labels — the one canonical spelling, shared by the
 *  confirmed list, the explorer, and any future surface. */
export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  PER_PIECE: "per piece",
  PER_AREA: "per area",
  STARTING_FROM: "starting from",
  QUOTE_ONLY: "quote only",
};

/** "from ₹2,400", "starting at 2400", "price starts from" — a floor, not a price.
 * Exported so markup-shape detection (B5) shares one phrase vocabulary with
 * basis derivation — two lists that drift apart are a rule that lies. */
export const STARTING_FROM_PHRASES = [
  /\bstarting\s+(?:from|at)\b/i,
  /\bstarts?\s+(?:from|at)\s*(?:₹|rs\.?|inr)?\s*\d/i,
  /\bprice\s+(?:starts|starting)\b/i,
  /\bfrom\s*(?:₹|rs\.?|inr)\s*[\d,]+/i,
  /\bonwards?\b/i,
];

/** "per sq ft", "per square foot", "/sqft" — an area rate, not a piece price. */
export const PER_AREA_PHRASES = [
  /\bper\s+(?:sq\.?\s*(?:ft|feet|foot|m|metre|meter)|square\s+(?:foot|feet|metre|meter))\b/i,
  /\/\s*sq\.?\s*(?:ft|m)\b/i,
  /\bper\s+square\b/i,
];

/** "price on request", "call for price", "request a quote", "enquire". */
export const QUOTE_ONLY_PHRASES = [
  /\bprice\s+on\s+(?:request|enquiry|inquiry)\b/i,
  /\b(?:call|contact|ask)\s+(?:us\s+)?for\s+(?:a\s+)?(?:price|quote|pricing)\b/i,
  /\brequest\s+a?\s*quote\b/i,
  /\bget\s+a?\s*quote\b/i,
  /\bpoa\b/i,
  /\bmade\s+to\s+order\s*[-—:]\s*quote\b/i,
];

export function matchesAnyPhrase(patterns: RegExp[], haystack: string): boolean {
  return patterns.some((re) => re.test(haystack));
}

/**
 * Decide a variant's price basis from the price we extracted and the text the
 * source published around it.
 *
 * Order matters and is not arbitrary:
 *
 *  1. An explicit quote phrase wins even when a number was parsed — a studio
 *     that writes "price on request" beside a ₹1 placeholder means the phrase.
 *  2. No parseable price at all is QUOTE_ONLY. This is the common case and
 *     the one that used to become a zero.
 *  3. Area rates before "starting from": "from ₹500 per sq ft" is an area
 *     rate whose floor is also given, and the rate is the more specific fact.
 *  4. Otherwise PER_PIECE, the honest default for a catalogue listing.
 */
export function derivePriceBasis(input: {
  priceMinor: number | null;
  /** Title + description + any price label the adapter saw. */
  text?: string;
}): PriceBasis {
  const text = (input.text ?? "").slice(0, 4000);

  if (text && matchesAnyPhrase(QUOTE_ONLY_PHRASES, text)) return "QUOTE_ONLY";
  if (input.priceMinor === null) return "QUOTE_ONLY";
  if (text && matchesAnyPhrase(PER_AREA_PHRASES, text)) return "PER_AREA";
  if (text && matchesAnyPhrase(STARTING_FROM_PHRASES, text)) return "STARTING_FROM";
  return "PER_PIECE";
}

/**
 * The price to STORE for a basis — null for QUOTE_ONLY, whatever we parsed
 * otherwise.
 *
 * A separate function rather than an inline ternary because this is the rule
 * the whole module exists for, and it should be greppable and testable on its
 * own: **a quote-only row never carries a number, not even a zero.**
 */
export function priceForBasis(
  basis: PriceBasis,
  priceMinor: number | null,
): number | null {
  return basis === "QUOTE_ONLY" ? null : priceMinor;
}

/** Major units (₹1,499) to minor (149900). Null stays null. */
export function toMinorUnits(major: number | null | undefined): number | null {
  if (major === null || major === undefined || !Number.isFinite(major)) {
    return null;
  }
  return Math.round(major * 100);
}
