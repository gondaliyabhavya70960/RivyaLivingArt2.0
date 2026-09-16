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
 * One card foundation, tier-specific variants — docs/plan/07's "shared
 * design foundation with tier-specific variants" and its rule that the
 * branch lives in a PURE module, because there is no component-test runner
 * here and a branch living in JSX is permanently untestable.
 *
 * `full` and `compact` are §4.6's, decided per GRID by `shelfVariant`.
 * `collectible` is the LARGE_FORMAT tier's (step 7). The MEDIUM ("memory")
 * and SMALL ("gift") variants are step 8's; until they exist, those tiers
 * and the untiered backlog all resolve to `full`, and the test pins that so
 * nobody ships a variant name the component does not render.
 */
export type CardVariant = "full" | "compact" | "collectible";

export function cardVariantFor(
  item: Pick<ShopProductItem, "sizeTier">,
): CardVariant {
  return item.sizeTier === "LARGE_FORMAT" ? "collectible" : "full";
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
  const priced = item.showPrice && item.priceMin != null;
  const price: CollectiblePrice = !priced
    ? { kind: "onRequest" }
    : item.priceMax != null && item.priceMax !== item.priceMin
      ? { kind: "range", label: formatPriceBand(item.priceMin, item.priceMax) }
      : { kind: "figure", label: formatPriceBand(item.priceMin, item.priceMax) };
  return {
    objectType: item.categoryName?.trim() || null,
    materials: item.materials?.trim() || null,
    dimensions: item.dimensions?.trim() || null,
    availability: item.inStock ? "madeToOrder" : "outOfStock",
    price,
  };
}
