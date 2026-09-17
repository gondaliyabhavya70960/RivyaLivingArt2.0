import type { ScrapeTier } from "@/generated/prisma/enums";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NAME,
  SIZE_TIER_NUMBER,
  type ProductSizeTier,
} from "@/lib/product-size-tier";

/**
 * Removing a source website, and everything that came from it.
 *
 * Deleting the `ScrapeSource` row alone leaves the wreckage behind: its jobs
 * survive with a null sourceId (`onDelete: SetNull`), their staged products
 * survive with them, and the sheet keeps every row the source ever produced.
 * The registry looks clean and nothing else is.
 *
 * A purge is the deliberate opposite of the per-product delete rule. There,
 * the staged rows are left alone because they record what a supplier's site
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
  catalogProducts: number;
};

/**
 * The import-list number a source tier maps onto (`TIER_NUMBER`, below).
 *
 * Catalog products carry `Product.tier` (1–4), the import list the catalog-fill
 * importer wrote them from, and that is the ONLY reliable link once a source
 * row is gone. Matching purge targets by `importSource` alone strands every
 * product whose source was removed earlier — on this database that was 2,500
 * of 3,500 rows, silently left behind by a purge that reported success.
 */
/**
 * Every source-tier value, in the order the owner thinks about them: size
 * tiers first, largest first, then the retired provenance ones.
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
 * A source tier's matching `Product.tier` — its import list — or null when it
 * has none.
 *
 * THIS IS A BRIDGE BETWEEN TWO DIFFERENT TIER SYSTEMS and the null is the
 * whole point. `Product.tier` is an integer written by the catalog-fill
 * importer from the committed CSVs — `Tier1_Owner.csv.gz` writes 1,
 * `Tier2_ResinGoods.csv.gz` writes 2, and so on. The purge uses that number to
 * catch catalog products whose `importSource` no longer matches any live
 * source key.
 *
 * The four retired PROVENANCE values line up with those files one-for-one,
 * because they were named after them. The three SIZE values do not line up with anything: a
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
 * The `Product.tier` numbers — import lists — a set of source tiers maps onto,
 * size values dropped, duplicates collapsed.
 *
 * Exists so no caller has to remember that the map is partial. Returning an
 * empty array is meaningful: it says "these sources correspond to no
 * import list", and the purge must then match on `importSource` alone
 * rather than widening to every product.
 */
export function tierNumbersFor(tiers: readonly ScrapeTier[]): number[] {
  return [
    ...new Set(
      tiers.map((t) => TIER_NUMBER[t]).filter((n): n is number => n !== null),
    ),
  ];
}

/**
 * THE ONE PLACE A SOURCE TIER IS PUT INTO WORDS.
 *
 * Three columns are called "tier" and the owner has ruled on the word: in the
 * Studio, "tier" is the PRODUCT tier (`Product.sizeTier`, the three-tier
 * architecture), `Product.tier` is an "import list" (`src/lib/import-list.ts`)
 * and `ScrapeSource.tier` — this one — is a "source tier". The review inbox,
 * the source registry, the source page and the job dashboard used to carry
 * four separate hand-typed copies of these labels beside this one, and every
 * copy said "Tier 1 — Large" for a supplier list — the same words, on the
 * next screen over, as the product tier and the import list. A screen that
 * needs a source tier's name reads it from here or from
 * `scrapeTierStudioLabel`, never from a local table.
 *
 * `TIER_LABEL` is the NOUN a sentence can take — "remove all resin goods
 * sources", "no large-format sources to remove" — so it carries no "Tier N"
 * prefix at all. The three size values read as sizes, because that is what a
 * supplier list filed under them is: a list of large-format sellers, not a
 * list of collectibles. The four retired provenance values keep the plain
 * noun they always had.
 */
export const TIER_LABEL: Record<ScrapeTier, string> = {
  LARGE_FORMAT: "Large-format",
  MEDIUM_FORMAT: "Medium-format",
  SMALL_FORMAT: "Small-format",
  OWNER: "Owner",
  RESIN_GOODS: "Resin goods",
  SUPPLIES: "Supplies",
  PRINT3D: "3D print",
};

/**
 * One or two words for a dense cell — the registry row's "Large · IN ·
 * Supply" line and the overview table. Distinct from `SIZE_TIER_SHORT`
 * (Collectible · Memory · Personal) on purpose: a source's tier says which
 * list we went looking in, not what any piece from it is.
 */
export const SCRAPE_TIER_SHORT: Record<ScrapeTier, string> = {
  LARGE_FORMAT: "Large",
  MEDIUM_FORMAT: "Medium",
  SMALL_FORMAT: "Small",
  OWNER: "Owner",
  RESIN_GOODS: "Resin goods",
  SUPPLIES: "Supplies",
  PRINT3D: "3D print",
};

/**
 * The product tier a SIZE source tier is named after, or null for the four
 * retired provenance values.
 *
 * The three size values are the same three strings as `ProductSizeTier`, and
 * that is a naming choice, not a link: a large-format supplier sells coasters
 * too, so a source's tier never decides a product's (`suggestSizeTier` does).
 * What the shared name DOES give us is the label — a source tier reads "Tier
 * 1 — Collectible Furniture & Spatial Art" with the product tier's own number
 * and name, derived here rather than typed, so the two can never say
 * different things about the same "Tier 1".
 */
export function sizeTierNamedBy(tier: ScrapeTier): ProductSizeTier | null {
  return (PRODUCT_SIZE_TIERS as readonly string[]).includes(tier)
    ? (tier as ProductSizeTier)
    : null;
}

/** The plain noun a retired provenance value reads as in a heading or a badge. */
const RETIRED_TIER_NOUN: Record<
  Exclude<ScrapeTier, ProductSizeTier>,
  string
> = {
  OWNER: "Owner's store",
  RESIN_GOODS: "Resin goods",
  SUPPLIES: "Supplies",
  PRINT3D: "3D print",
};

/**
 * A source tier's label for a select option, a tab, a badge or a batch
 * button — both vocabularies at once, the way `sizeTierStudioLabel` does it
 * for the product tier.
 *
 * A size value reads "Tier 1 — Collectible Furniture & Spatial Art", the
 * number and the name taken from `product-size-tier.ts`. Pass `"sources"`
 * where the screen puts this next to a PRODUCT-tier control — the review
 * inbox's two filters sit side by side — and it reads "Tier 1 sources —
 * Collectible Furniture & Spatial Art", so the two lists of options cannot
 * be told apart only by which select they fell out of. A retired provenance
 * value has no number to speak of and reads as its noun: "Owner's store",
 * "Resin goods", "Supplies", "3D print" (with the qualifier, "Resin goods
 * sources"). Never "Tier 4 — 3D print": the word "tier" is the product
 * tier's now, and a numbered "Owner" was the catalog-fill label this and
 * `import-list.ts` replaced.
 */
export function scrapeTierStudioLabel(
  tier: ScrapeTier,
  qualifier?: "sources",
): string {
  const size = sizeTierNamedBy(tier);
  if (size) {
    const head = `Tier ${SIZE_TIER_NUMBER[size]}`;
    return `${qualifier ? `${head} ${qualifier}` : head} — ${SIZE_TIER_NAME[size]}`;
  }
  const noun = RETIRED_TIER_NOUN[tier as keyof typeof RETIRED_TIER_NOUN];
  return qualifier ? `${noun} ${qualifier}` : noun;
}

/**
 * What a purge is about to do, in a sentence somebody can refuse.
 *
 * Every number is named. "This will remove 38 sources" hides that it also
 * takes 12,000 staged products with it, and the second number is the one
 * worth pausing over.
 */
export function describePurgePlan(
  label: string,
  counts: PurgeCounts,
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
      ? ` ${counts.catalogProducts.toLocaleString("en-IN")} catalog product${counts.catalogProducts === 1 ? "" : "s"} from this source tier will be KEPT.`
      : "";

  return `Remove ${label}: ${parts.join(", ")}.${tail}`;
}

/** A purge that would remove nothing should say so rather than pretend. */
export function isEmptyPurge(counts: PurgeCounts): boolean {
  return counts.sources === 0 && counts.stagedProducts === 0;
}
