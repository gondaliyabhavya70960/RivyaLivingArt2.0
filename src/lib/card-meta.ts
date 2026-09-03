import type { ShopProductItem } from "@/lib/shop";

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
