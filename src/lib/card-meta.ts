import type { ShopProductItem } from "@/lib/shop";
import { formatPriceBand } from "@/lib/utils";

/**
 * The catalog card's mono meta line — D21.
 *
 * "Materials · Dimensions", both owner-typed free text (`Product.materials`,
 * `Product.dimensions`), rendered exactly as written and joined with the
 * site's mono separator. Either half may be absent; `null` when NEITHER is
 * present so the caller can skip the line entirely rather than rendering an
 * empty `u-micro` row (Part 9: "a panel with nothing in it is never
 * constructed" — the same rule applied to a single line here).
 */
export function cardMetaLine(
  item: Pick<ShopProductItem, "materials" | "dimensions">,
): string | null {
  const parts = [item.materials, item.dimensions].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/**
 * The card link's accessible name — REDESIGN.md Part 17: "Card links carry
 * the full title even when the visible text clamps. No `…` in the accessible
 * name." `displayTitle` is the editorial short name and `editorialName()`
 * truncates it with an ellipsis for long catalogue titles — fine to look at,
 * wrong to hear. `title` is the full, un-truncated catalogue title, so it is
 * always what a screen reader announces for the link, regardless of what the
 * card paints.
 */
export function accessibleCardName(
  item: Pick<ShopProductItem, "title">,
): string {
  return item.title;
}

/**
 * ————— Moved here from `catalog-product-card.tsx` on 2026-09-18 —————
 *
 * For the reason this module's header already gives: the vitest suite covers
 * pure `src/lib` functions, and a rule living in a component file cannot be
 * imported by a test without dragging `next/link` into a node environment.
 * `shelfVariant` had no test at all while it lived there. It decides a grid,
 * not a pixel, so it belongs beside `cardVariantFor`.
 *
 * Below this the piece is a part, not a piece — REDESIGN.md §4.6: "Compact
 * variant for items under ₹1,000 … This is what stops a ₹8 part sharing
 * visual furniture with a ₹16,499 frame."
 */
export const COMPACT_PRICE_CEILING = 1000;

/**
 * The variant for a WHOLE grid, decided by what is in it.
 *
 * §4.6 asks for two things that pull against each other: a compact card for
 * items under ₹1,000, and "never mix random aspect ratios in one grid".
 * Deriving the variant per card satisfies the first and breaks the second —
 * a 1:1 tile beside a 4:5 one makes every row ragged. So the *shelf* picks:
 * when most of what is on it is parts rather than pieces, the whole grid goes
 * compact (and denser, 4–6 up, as the spec's own note says); otherwise every
 * card is full. One ratio per context, which is the rule the image-discipline
 * paragraph actually turns on.
 *
 * **A TIERED ROW IS NEVER A PART, whatever it costs** (2026-09-18). Price was
 * the only available proxy for "is this a piece?" when this was written, and
 * it conflates two different cheap things: a ₹8 bezel finding, and a ₹399
 * resin jhumka that is a finished piece in the SMALL tier. `Product.sizeTier`
 * answers the question directly and did not exist yet — `catalog-size-tier.ts`
 * files a row into a tier only when it is a PIECE, and deliberately has no
 * fourth tier for "not a piece", so ~3,500 molds, pigments and filaments stay
 * null by rule.
 *
 * Measured on the real catalogue, which is why this is not a refinement: all
 * 12 published LARGE_FORMAT rows and 373 of 425 SMALL_FORMAT rows sit under
 * ₹1,000. Without this clause a large-format grid — the editorial tier, by
 * definition — rendered as a dense 1:1 supplies shelf, and the `gift` variant
 * could never appear on the tier it was built for.
 */
export function shelfVariant(
  items: readonly Pick<ShopProductItem, "showPrice" | "priceMin" | "sizeTier">[],
): "full" | "compact" {
  const priced = items.filter(
    (item) => item.showPrice && item.priceMin != null,
  );
  if (priced.length < 4) return "full";
  const parts = priced.filter(
    (item) =>
      item.sizeTier == null && (item.priceMin as number) < COMPACT_PRICE_CEILING,
  ).length;
  return parts / priced.length >= 0.7 ? "compact" : "full";
}

/**
 * One card foundation, tier-specific variants — docs/plan/07's "shared
 * design foundation with tier-specific variants" and its rule that the
 * branch lives in a PURE module, because there is no component-test runner
 * here and a branch living in JSX is permanently untestable.
 *
 * `full` and `compact` are §4.6's, decided per GRID by `shelfVariant`.
 * The three tier variants are decided per PRODUCT by its `sizeTier`:
 * `collectible` (LARGE, step 7), `memory` (MEDIUM) and `gift` (SMALL), the
 * last two shipped 2026-09-18 as step 8.
 *
 * **The untiered backlog still resolves to `full`, and that is the point of
 * the null check rather than an oversight.** ~4,385 catalogue rows carry no
 * `sizeTier`; giving them a tier variant would be inventing the answer for
 * every one of them. `full` is the variant that claims nothing.
 */
export type CardVariant =
  | "full"
  | "compact"
  | "collectible"
  | "memory"
  | "gift";

export function cardVariantFor(
  item: Pick<ShopProductItem, "sizeTier">,
): CardVariant {
  switch (item.sizeTier) {
    case "LARGE_FORMAT":
      return "collectible";
    case "MEDIUM_FORMAT":
      return "memory";
    case "SMALL_FORMAT":
      return "gift";
    default:
      return "full";
  }
}

/**
 * The price a collectible card shows: a figure, a band, or "price on
 * request" — the brief's own three (Price / Starting From / Price on
 * Request). "Starting from" is deliberately NOT derived: a price band's
 * floor is not a starting price, and a `priceType` field is T3, an open
 * owner question. `onRequest` carries no label: the caller translates it,
 * so `formatPriceBand`'s hardcoded English "Enquire" can never reach a
 * card (T6). The guard is the same one the full card already uses.
 */
export type CollectiblePrice =
  | { kind: "figure" | "range"; label: string }
  | { kind: "onRequest" };

export type CollectibleCardMeta = {
  /** The brief's "object type" — the category's name; null when blank. */
  objectType: string | null;
  /** Owner-typed free text, rendered as written. */
  materials: string | null;
  /** Owner-typed free text, rendered as written, in mono. */
  dimensions: string | null;
  /**
   * The brief's "edition / bespoke indicator". `inStock` IS the
   * made-to-order fact on this catalogue (T5: the card already renders
   * "Made to order" from it); there is no edition column (T3), so nothing
   * else is invented.
   */
  availability: "madeToOrder" | "outOfStock";
  price: CollectiblePrice;
};

export function collectibleCardMeta(
  item: Pick<
    ShopProductItem,
    | "categoryName"
    | "materials"
    | "dimensions"
    | "inStock"
    | "showPrice"
    | "priceMin"
    | "priceMax"
  >,
): CollectibleCardMeta {
  return {
    objectType: item.categoryName?.trim() || null,
    materials: item.materials?.trim() || null,
    dimensions: item.dimensions?.trim() || null,
    availability: item.inStock ? "madeToOrder" : "outOfStock",
    price: cardPrice(item),
  };
}

/**
 * The price rule, once, for all three tier variants.
 *
 * It was inlined in `collectibleCardMeta` while that was the only variant.
 * Three copies of "showPrice && priceMin != null" is three chances for one of
 * them to let `formatPriceBand`'s hardcoded English "Enquire" onto a card in
 * nine locales — the exact leak T6 closed.
 */
function cardPrice(
  item: Pick<ShopProductItem, "showPrice" | "priceMin" | "priceMax">,
): CollectiblePrice {
  if (!item.showPrice || item.priceMin == null) return { kind: "onRequest" };
  return item.priceMax != null && item.priceMax !== item.priceMin
    ? { kind: "range", label: formatPriceBand(item.priceMin, item.priceMax) }
    : { kind: "figure", label: formatPriceBand(item.priceMin, item.priceMax) };
}

/**
 * The MEMORY card — MEDIUM_FORMAT, docs/plan/07: "guided customization is the
 * whole product".
 *
 * So the card answers the two questions a commemorative piece raises and the
 * `full` card does not: **what do I get to choose**, and **how long until I
 * have it**. It deliberately does NOT show materials and dimensions — that is
 * the `collectible` card's content, because a collectible is an object and
 * this is a service that ends in one.
 *
 * `choices` is a COUNT, never `variantChips`' strings. Those are built in
 * `shop.ts` as hardcoded English ("Colours +3", "Sizes S/M/L") and are
 * rendered nowhere today; putting them on a card would paint English into
 * nine locales. The count goes through translated copy instead.
 */
export type MemoryCardMeta = {
  /** The category, already localized upstream; null when blank. */
  occasion: string | null;
  /** How many customization fields carry options. 0 → the caller skips the line. */
  choices: number;
  /** Owner-typed lead time, rendered as written; null when unset. */
  leadTime: string | null;
  availability: "madeToOrder" | "outOfStock";
  price: CollectiblePrice;
};

export function memoryCardMeta(
  item: Pick<
    ShopProductItem,
    | "categoryName"
    | "variantChips"
    | "timeline"
    | "inStock"
    | "showPrice"
    | "priceMin"
    | "priceMax"
  >,
): MemoryCardMeta {
  return {
    occasion: item.categoryName?.trim() || null,
    choices: item.variantChips.length,
    leadTime: item.timeline?.trim() || null,
    availability: item.inStock ? "madeToOrder" : "outOfStock",
    price: cardPrice(item),
  };
}

/**
 * The GIFT card — SMALL_FORMAT, docs/plan/07: "efficient grid, quick
 * personalization, variants, price visible".
 *
 * "Price visible" is the instruction that shapes it: the price moves ABOVE the
 * availability line, where the other variants put it below. Density comes from
 * dropping the category eyebrow and the materials line, not from dropping the
 * affordance — the tile keeps its "View piece" cue like every other card.
 *
 * `price` still resolves to `onRequest` when the owner has not published one.
 * "Price visible" is how this tier is MEANT to be filled in, not a promise the
 * card can keep on a row that has no figure, and `formatPriceBand`'s hardcoded
 * English "Enquire" must never reach a card (T6).
 */
export type GiftCardMeta = {
  choices: number;
  availability: "madeToOrder" | "outOfStock";
  price: CollectiblePrice;
};

export function giftCardMeta(
  item: Pick<
    ShopProductItem,
    "variantChips" | "inStock" | "showPrice" | "priceMin" | "priceMax"
  >,
): GiftCardMeta {
  return {
    choices: item.variantChips.length,
    availability: item.inStock ? "madeToOrder" : "outOfStock",
    price: cardPrice(item),
  };
}
