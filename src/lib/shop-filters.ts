import { OCCASIONS } from "@/components/studio/products/occasions";
import { CATALOG_GROUPS, type CatalogGroup } from "@/lib/catalog-taxonomy";

/**
 * Client-safe shop filter vocabulary. `@/lib/shop` re-exports everything
 * here for server code; client components (ShopExplorer) import from THIS
 * file so the Prisma-backed server lib never enters a client bundle.
 */

export { OCCASIONS };
export { CATALOG_GROUPS, type CatalogGroup };

/** Ecosystem tab order for the shop's browse tabs (v6 catalog groups). */
export const ECOSYSTEMS = [
  "art",
  "supplies",
  "print",
] as const satisfies readonly CatalogGroup[];

export function isEcosystem(value: unknown): value is CatalogGroup {
  return (
    typeof value === "string" &&
    (ECOSYSTEMS as readonly string[]).includes(value)
  );
}

export type PriceBand = {
  key: string;
  label: string;
  /** Inclusive lower bound in ₹. Absent = no floor. */
  min?: number;
  /** Inclusive upper bound in ₹. Absent = no ceiling. */
  max?: number;
};

export const PRICE_BANDS: readonly PriceBand[] = [
  { key: "under-1k", label: "Under ₹1,000", max: 1000 },
  { key: "1k-5k", label: "₹1,000 – ₹5,000", min: 1000, max: 5000 },
  { key: "5k-15k", label: "₹5,000 – ₹15,000", min: 5000, max: 15000 },
  { key: "15k-50k", label: "₹15,000 – ₹50,000", min: 15000, max: 50000 },
  { key: "above-50k", label: "Above ₹50,000", min: 50000 },
] as const;

/**
 * REDESIGN.md §7.4's sort menu, in the spec's order:
 * `Featured · Newest · Price low→high · Price high→low · Name`.
 */
export const SORTS = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "name",
] as const;

export type SortKey = (typeof SORTS)[number];

/**
 * v6 default: featured-first merchandising (featured desc → tier asc →
 * newest). The URL omits ?sort= for this key.
 */
export const DEFAULT_SORT: SortKey = "featured";

export function isSortKey(value: unknown): value is SortKey {
  return (
    typeof value === "string" && (SORTS as readonly string[]).includes(value)
  );
}

/** URL-driven filters shared by /shop, /shop/[category] and loadMoreProducts. */
export type ShopFilters = {
  q?: string;
  category?: string;
  occasion?: string;
  band?: string;
  /** Ecosystem group (?type=art|supplies|print) → category slugs of the group. */
  type?: string;
  /** Availability (?stock=in) → inStock only. */
  stock?: string;
};
