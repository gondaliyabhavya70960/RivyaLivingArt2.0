/**
 * The four IMPORT LISTS — where a catalogue row CAME FROM.
 *
 * `Product.tier` is an Int written by `src/lib/import/tier-fill.ts` from the
 * committed `data/tiers/*.csv.gz` files: 1 the owner's previous store,
 * 2 resin goods, 3 supplies, 4 3D printing. It is PROVENANCE, and it is read
 * by the shop's default sort and the search ranking, so the column, its
 * values and the file names never change. What changed on 2026-09-17 is the
 * WORD: for a year the Studio called these "Tier 1 … Tier 4", and since
 * 2026-09-15 the PRODUCT tier — the three-tier architecture,
 * `Product.sizeTier`, `src/lib/product-size-tier.ts` — has printed as
 * "Tier 1 … Tier 3" beside them. Two columns, the same numbers, the same
 * word, on adjacent screens. "Tier" now means the product tier everywhere a
 * person reads it; these are lists.
 *
 * The number stays the column value, the URL value (`/studio/products?tier=1`),
 * the form value and the CSV cell (`tier`), because those are contracts.
 * ONE copy of the words: the products list, the product form, the overview
 * strip, the catalog-fill screen and the provenance panels all read this
 * file — the five hand-typed copies it replaced were the same trap CLAUDE.md
 * records for the scrape tiers, where the fifth copy shipped three tiers
 * invisible.
 */

export const IMPORT_LISTS = [1, 2, 3, 4] as const;
export type ImportList = (typeof IMPORT_LISTS)[number];

/** The list's name, the words the owner uses for it. */
export const IMPORT_LIST_NAME: Record<ImportList, string> = {
  1: "Owner's store",
  2: "Resin goods",
  3: "Supplies",
  4: "3D printing",
};

/** One or two words for a dense table cell. */
export const IMPORT_LIST_SHORT: Record<ImportList, string> = {
  1: "Owner",
  2: "Resin goods",
  3: "Supplies",
  4: "3D print",
};

/**
 * The committed file each list is read from — `data/tiers/<stem>.csv.gz`.
 * Frozen: the stems are the read path in `tier-fill.ts` and the keys of every
 * `sheet-import` activity row already written, and a test pins them to the
 * reader so the two can never drift.
 */
export const IMPORT_LIST_FILE: Record<ImportList, string> = {
  1: "Tier1_Owner",
  2: "Tier2_ResinGoods",
  3: "Tier3_Supplies",
  4: "Tier4_3DPrint",
};

/** "List 1 — Owner's store": the label a select, a strip or a badge shows. */
export function importListLabel(list: ImportList): string {
  return `List ${list} — ${IMPORT_LIST_NAME[list]}`;
}

/** A `Product.tier` value → its list, or null for a studio product (no list). */
export function importListOf(
  tier: number | null | undefined,
): ImportList | null {
  return tier != null && (IMPORT_LISTS as readonly number[]).includes(tier)
    ? (tier as ImportList)
    : null;
}
