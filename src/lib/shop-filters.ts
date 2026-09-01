import { OCCASIONS } from "@/components/studio/products/occasions";
import {
  CATALOG_GROUPS,
  type CatalogGroup,
  groupForCategorySlug,
} from "@/lib/catalog-taxonomy";

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

/**
 * The explicit "every ecosystem at once" view.
 *
 * Deliberately NOT a member of `ECOSYSTEMS`, so `isEcosystem()` rejects it and
 * `buildProductWhere` adds no category clause — the sentinel means "no
 * ecosystem constraint" by being unrecognised, not by a second code path.
 */
export const ALL_ECOSYSTEMS = "all";

/**
 * The ecosystem a bare `/shop` leads with.
 *
 * Supplies and 3D printing are ~2,900 of the 4,373 published products (1,841
 * molds and tools, 648 pigments, 400 filaments, 96 printer parts). Opening the
 * shop of an art house on sanding kits and PLA is not what the catalogue is
 * for, so `/shop` is the art ecosystem and the other two keep their own tabs
 * and their own category pages. Nothing is unpublished and no URL 404s —
 * `?type=all` restores the mixed view.
 */
export const DEFAULT_ECOSYSTEM: CatalogGroup = "art";

/**
 * Resolve `?type=` to the value the query and the links both use.
 *
 * Returns the sentinel or a real ecosystem verbatim, and falls back to the
 * default for absent OR unrecognised input — a stale `?type=v6` lands on the
 * art shelf rather than silently reopening the mixed catalogue.
 */
export function normalizeEcosystemParam(
  value: string | undefined,
  categorySlug?: string,
): string {
  if (value === ALL_ECOSYSTEMS) return ALL_ECOSYSTEMS;
  if (isEcosystem(value)) return value;
  if (categorySlug) return groupForCategorySlug(categorySlug);
  return DEFAULT_ECOSYSTEM;
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
