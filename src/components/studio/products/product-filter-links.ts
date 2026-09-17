import type { ImportList } from "@/lib/import-list";
import type { ProductSizeTier } from "@/lib/product-size-tier";
import {
  productListFilterSchema,
  type ProductListFilter,
} from "./product-filter";

/**
 * The INVERSE of `parseProductListFilter`: a filter → the `/studio/products`
 * URL that re-applies it. Every deep link into the product list from another
 * Studio screen (the overview's strips, the content-gaps card) should be
 * built here rather than as a template string, so a link can be pinned by
 * test to parse back into the filter it means — `?sizeTier=NONE` is a real
 * value and `?tier=1` is a different column, and a hand-typed link that got
 * either wrong would show the owner the wrong rows under the right label.
 *
 * Plain module, like the parser: no directive, importable from an RSC page
 * and from a test.
 */

/** Keys in schema declaration order, so a built URL is deterministic. */
const FILTER_KEYS = Object.keys(
  productListFilterSchema.shape,
) as (keyof ProductListFilter)[];

export function productListHref(filter: ProductListFilter): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/studio/products?${qs}` : "/studio/products";
}

/**
 * The overview's PRODUCT TIERS strip: one tier, or `"NONE"` for the untiered
 * backlog. The list defaults to its Published tab, which is the population
 * the strip counts.
 */
export function sizeTierStripHref(tier: ProductSizeTier | "NONE"): string {
  return productListHref({ sizeTier: tier });
}

/**
 * The overview's import-list strip: `?tier=1` — the URL value is the column
 * value, `Product.tier`, and a contract; only the label beside it says
 * "List 1".
 */
export function importListStripHref(list: ImportList): string {
  return productListHref({ tier: `${list}` });
}
