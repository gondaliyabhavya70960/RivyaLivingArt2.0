import type { ScrapeTier } from "@/generated/prisma/enums";

/**
 * Removing a source website, and everything that came from it.
 *
 * Deleting the `ScrapeSource` row alone leaves the wreckage behind: its jobs
 * survive with a null sourceId (`onDelete: SetNull`), their staged products
 * survive with them, and the sheet keeps every row the source ever produced.
 * The registry looks clean and nothing else is.
 *
 * A purge is the deliberate opposite of the per-product delete rule. There,
 * the tier tabs are left alone because they record what a supplier's site
 * said, and removing one product from your catalogue does not un-happen the
 * scrape. Here the supplier itself is being removed — the scrape deck is
 * exactly what should go with it.
 */

export type PurgeScope = {
  /** Also delete catalog products imported from these sources. */
  deleteCatalogProducts: boolean;
};

export type PurgeCounts = {
  sources: number;
  stagedProducts: number;
  jobs: number;
  sheetRows: number;
  catalogProducts: number;
};

/**
 * The catalog's tier number for a scrape tier.
 *
 * Catalog products carry `Product.tier` (1–4) from the sheet import, and that
 * is the ONLY reliable link once a source row is gone. Matching purge targets
 * by `importSource` alone strands every product whose source was removed
 * earlier — on this database that was 2,500 of 3,500 rows, silently left
 * behind by a purge that reported success.
 */
/**
 * Every tier value, in the order the owner thinks about them: size tiers
 * first, largest first, then the retired provenance ones.
 *
 * Exported as a tuple so the zod schemas in the actions can be built from it.
 * They used to spell the four values out inline in four places, which is three
 * chances to forget one when the enum grows — and a forgotten one is a tier an
 * operator can see in the UI but cannot save.
 */
export const SCRAPE_TIERS = [
  "LARGE_FORMAT",
  "MEDIUM_FORMAT",
  "SMALL_FORMAT",
  "OWNER",
  "RESIN_GOODS",
  "SUPPLIES",
  "PRINT3D",
] as const satisfies readonly ScrapeTier[];

/**
 * A scrape tier's matching `Product.tier`, or null when it has none.
 *
 * THIS IS A BRIDGE BETWEEN TWO DIFFERENT TIER SYSTEMS and the null is the
 * whole point. `Product.tier` is an integer written by the catalog-fill
 * importer from the committed CSVs — `Tier1_Owner.csv.gz` writes 1,
 * `Tier2_ResinGoods.csv.gz` writes 2, and so on. The purge uses that number to
 * catch catalog products whose `importSource` no longer matches any live
 * source key.
 *
 * The four PROVENANCE tiers line up with those files one-for-one, because they
 * were named after them. The three SIZE tiers do not line up with anything: a
 * source filed under LARGE_FORMAT never came from `data/tiers/*.csv.gz`, so it
 * must contribute NO number. Giving it one — say LARGE_FORMAT: 1 — would make
 * purging large-format sources delete every product imported from
 * `Tier1_Owner.csv.gz`, which has nothing to do with them. Callers therefore
 * filter the nulls out rather than defaulting them.
 */
export const TIER_NUMBER: Record<ScrapeTier, number | null> = {
  LARGE_FORMAT: null,
  MEDIUM_FORMAT: null,
  SMALL_FORMAT: null,
  OWNER: 1,
  RESIN_GOODS: 2,
  SUPPLIES: 3,
  PRINT3D: 4,
};

/**
 * The `Product.tier` numbers a set of scrape tiers maps onto — size tiers
 * dropped, duplicates collapsed.
 *
 * Exists so no caller has to remember that the map is partial. Returning an
 * empty array is meaningful: it says "these sources correspond to no
 * catalog-fill tier", and the purge must then match on `importSource` alone
 * rather than widening to every product.
 */
export function tierNumbersFor(tiers: readonly ScrapeTier[]): number[] {
  return [
    ...new Set(
      tiers
        .map((t) => TIER_NUMBER[t])
        .filter((n): n is number => n !== null),
    ),
  ];
}

/** Tiers by the words the owner uses for them. */
export const TIER_LABEL: Record<ScrapeTier, string> = {
  LARGE_FORMAT: "Large — furniture & tables",
  MEDIUM_FORMAT: "Medium — varmala, clocks, trays",
  SMALL_FORMAT: "Small — rakhis & jewellery",
  OWNER: "Owner",
  RESIN_GOODS: "Resin goods",
  SUPPLIES: "Supplies",
  PRINT3D: "3D print",
};

/**
 * What a purge is about to do, in a sentence somebody can refuse.
 *
 * Every number is named. "This will remove 38 sources" hides that it also
 * takes 12,000 staged products with it, and the second number is the one
 * worth pausing over.
 */
export function describePurgePlan(
  label: string,
  counts: Omit<PurgeCounts, "sheetRows">,
  scope: PurgeScope,
): string {
  const parts = [
    `${counts.sources} source${counts.sources === 1 ? "" : "s"}`,
    `${counts.stagedProducts.toLocaleString("en-IN")} staged product${counts.stagedProducts === 1 ? "" : "s"}`,
    `${counts.jobs} scrape job${counts.jobs === 1 ? "" : "s"}`,
  ];
  if (scope.deleteCatalogProducts && counts.catalogProducts > 0) {
    parts.push(
      `${counts.catalogProducts.toLocaleString("en-IN")} live catalog product${counts.catalogProducts === 1 ? "" : "s"}`,
    );
  }
  const tail =
    !scope.deleteCatalogProducts && counts.catalogProducts > 0
      ? ` ${counts.catalogProducts.toLocaleString("en-IN")} catalog product${counts.catalogProducts === 1 ? "" : "s"} in this tier will be KEPT.`
      : "";

  return `Remove ${label}: ${parts.join(", ")}, and their rows in the sheet.${tail}`;
}

/** A purge that would remove nothing should say so rather than pretend. */
export function isEmptyPurge(counts: Omit<PurgeCounts, "sheetRows">): boolean {
  return counts.sources === 0 && counts.stagedProducts === 0;
}
