import type { ProductSizeTier } from "@/lib/product-size-tier";

/**
 * The PDP's per-tier order-panel presets — docs/plan/07 step 8, through the
 * mechanism the out-of-stock enquiry already proved: server-resolved copy
 * that reframes the submit CTA, the summary note and the WhatsApp intro,
 * with a byte-identical payload when nothing applies.
 *
 * Three fields, read from the `ProductTier.<tier>` block that step 5 landed
 * (the CTA is the tier's own `primaryCta` — "Commission a piece", "Preserve
 * your memory", "Order on WhatsApp" — not a second CTA vocabulary). The
 * key is built from the enum value, so the tier list still lives once.
 *
 * `lookup` is the caller's own fallback-aware translator (`tp` on the page,
 * a `t.has ? t : tEn` closure in the action), so this module stays pure and
 * the English fallback lives where it already lives.
 */
export type TierOrderCopy = {
  /** Submit CTA — ProductTier.<tier>.primaryCta. */
  cta: string;
  /** First line of the live order summary — ProductTier.<tier>.orderSummaryNote. */
  summaryNote: string;
  /** The WhatsApp message's opening line — ProductTier.<tier>.orderWaIntro. */
  waIntro: string;
};

export const TIER_ORDER_COPY_FIELDS = {
  cta: "primaryCta",
  summaryNote: "orderSummaryNote",
  waIntro: "orderWaIntro",
} as const;

/** Key RELATIVE to the `ProductTier` namespace, e.g. "LARGE_FORMAT.orderWaIntro". */
export function tierOrderCopyKey(
  tier: ProductSizeTier,
  field: keyof typeof TIER_ORDER_COPY_FIELDS,
): string {
  return `${tier}.${TIER_ORDER_COPY_FIELDS[field]}`;
}

/**
 * The preset for a tier, or null for the untiered backlog — in which case
 * `lookup` is never called and the panel renders exactly what it did before
 * this module existed.
 */
export function tierOrderCopy(
  tier: ProductSizeTier | null | undefined,
  lookup: (key: string) => string,
): TierOrderCopy | null {
  if (!tier) return null;
  return {
    cta: lookup(tierOrderCopyKey(tier, "cta")),
    summaryNote: lookup(tierOrderCopyKey(tier, "summaryNote")),
    waIntro: lookup(tierOrderCopyKey(tier, "waIntro")),
  };
}

/**
 * THE precedence rule, in one place for the panel and the Server Action to
 * share: out of stock WINS over the tier. The out-of-stock copy states a
 * fact about the piece (it cannot ship; audit H2's honest enquiry) and the
 * operator reads the intro to know what the conversation IS — a LARGE
 * "commission" intro on an out-of-stock row would make the persisted
 * message claim the wrong thing. A tier's copy is a framing; a fact
 * outranks a framing.
 */
export function selectOrderCopy(input: {
  inStock: boolean;
  oosCopy: TierOrderCopy | null;
  tierCopy: TierOrderCopy | null;
}): TierOrderCopy | null {
  if (!input.inStock && input.oosCopy) return input.oosCopy;
  return input.tierCopy;
}
