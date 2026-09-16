import type { ContentStatus, ProductSizeTier } from "@/generated/prisma/enums";

/** Re-exported so a consumer can name the type without reaching for the
 *  generated client — `export/confirmed.ts` is pure by contract. Type-only,
 *  so it erases at compile and adds no runtime edge. */
export type { ProductSizeTier };

/**
 * THE OWNER'S THREE-TIER PRODUCT ARCHITECTURE.
 * docs/plan/07-three-tier-architecture.md — supplied 2026-09-15, in force.
 *
 * Three customer intents with different price ladders, customization depth and
 * interface density, sharing one brand language. NOT three filters on one grid,
 * and not three websites.
 *
 * THIS FILE IS THE ONLY PLACE THE LIST LIVES. The scrape-tier list was
 * hand-copied into five places before anyone noticed, and the fifth copy is
 * why the new tiers did not appear in the studio's filter row at all: the tabs
 * were built from a separate array nobody had told about the change. So every
 * consumer here — the zod enums, the select options, the labels, the storefront
 * — derives from `PRODUCT_SIZE_TIERS`, and `product-size-tier.test.ts` pins it
 * against the generated Prisma enum so adding a value to the schema and
 * forgetting this file fails a test rather than a screen.
 *
 * `ScrapeTier` carries the same three NAMES and is a different thing: which
 * supplier list we went looking in. A large-format supplier sells small pieces
 * too, so a source's tier never decides a product's.
 */
export const PRODUCT_SIZE_TIERS = [
  "LARGE_FORMAT",
  "MEDIUM_FORMAT",
  "SMALL_FORMAT",
] as const satisfies readonly ProductSizeTier[];

/**
 * What a CUSTOMER sees. "Tier 1/2/3" is internal vocabulary for the database
 * and the studio; these are the words that reach the storefront, and they go
 * through next-intl before they render — this map is the studio's copy and the
 * canonical English, not a public string.
 */
export const SIZE_TIER_NAME: Record<ProductSizeTier, string> = {
  LARGE_FORMAT: "Collectible Furniture & Spatial Art",
  MEDIUM_FORMAT: "Memory & Celebration Art",
  SMALL_FORMAT: "Personal Art & Gifting",
};

/**
 * One word per tier, for a dense table cell.
 *
 * `SIZE_TIER_NAME` is four words long and the studio's product list already
 * runs to the edge of 1440px — adding the full name as a column pushed it to
 * 1450 and the studio audit failed the route. A list cell is not where a
 * customer-facing name earns its keep; the form, the filter and the bulk
 * control all carry the full one.
 */
export const SIZE_TIER_SHORT: Record<ProductSizeTier, string> = {
  LARGE_FORMAT: "Collectible",
  MEDIUM_FORMAT: "Memory",
  SMALL_FORMAT: "Personal",
};

/** The work each tier covers, for the studio's field hint. */
export const SIZE_TIER_EXAMPLES: Record<ProductSizeTier, string> = {
  LARGE_FORMAT:
    "Dining, coffee, side and console tables · seating · benches · large wall panels · sculpture · installations",
  MEDIUM_FORMAT:
    "Varmala & bouquet preservation · wall clocks · engagement and ring trays · invitation preservation · wedding frames · nameplates · baby keepsakes",
  SMALL_FORMAT:
    "Rakhi · jewellery · keychains · bookmarks · coasters · magnets · desk pieces · festive and corporate gifting",
};

/** The internal number the owner speaks in: Tier 1 large → Tier 3 small. */
export const SIZE_TIER_NUMBER: Record<ProductSizeTier, 1 | 2 | 3> = {
  LARGE_FORMAT: 1,
  MEDIUM_FORMAT: 2,
  SMALL_FORMAT: 3,
};

/** Both vocabularies at once, which is what a studio label needs. */
export function sizeTierStudioLabel(tier: ProductSizeTier): string {
  return `Tier ${SIZE_TIER_NUMBER[tier]} — ${SIZE_TIER_NAME[tier]}`;
}

/**
 * Select options for the studio. `"none"` persists as SQL NULL, the same
 * convention `TIER_OPTIONS` and `IMAGE_ROLE_OPTIONS` already use in the product
 * form — a select cannot hold null, and "" is a value the owner can type.
 */
export const SIZE_TIER_OPTIONS = [
  { value: "none", label: "— not set yet" },
  ...PRODUCT_SIZE_TIERS.map((tier) => ({
    value: tier,
    label: sizeTierStudioLabel(tier),
  })),
] as const;

/** The form's select values: the three tiers plus the null sentinel. */
export const SIZE_TIER_FORM_VALUES = [
  "none",
  ...PRODUCT_SIZE_TIERS,
] as const satisfies readonly string[];

/** Form value → column value. */
export function sizeTierFromFormValue(
  value: (typeof SIZE_TIER_FORM_VALUES)[number],
): ProductSizeTier | null {
  return value === "none" ? null : value;
}

/** Column value → form value, total over null. */
export function sizeTierToFormValue(
  tier: ProductSizeTier | null | undefined,
): (typeof SIZE_TIER_FORM_VALUES)[number] {
  return tier ?? "none";
}

/**
 * Why this product may not be published, or null if it may.
 *
 * REFUSED AT THE PUBLISH TRANSITION, NOT ON EVERY SAVE, and the distinction is
 * the difference between a guardrail and a lockout. The column is new, so every
 * one of the ~4,385 rows already in the catalogue is untiered; refusing every
 * save of an already-published product would stop the owner editing any of them
 * until all of them were tiered, with no bulk tool yet built to do it. So an
 * already-live product keeps saving, and nothing NEW reaches the storefront
 * untiered. The backlog is step 3's job — a filter and a bulk action — and the
 * refusal below is what keeps it from growing while that is built.
 *
 * `null` in, `null` out only when the product is not becoming published: this
 * function is total and takes the transition, not just the desired state.
 */
export function describeSizeTierPublishProblem(input: {
  nextStatus: ContentStatus;
  currentStatus: ContentStatus | null;
  sizeTier: ProductSizeTier | null;
}): string | null {
  if (input.sizeTier !== null) return null;
  if (input.nextStatus !== "PUBLISHED") return null;
  if (input.currentStatus === "PUBLISHED") return null;
  return "Pick a product tier before publishing — collectible, memory or personal. It decides how this piece is presented and how it is found.";
}

/**
 * A spreadsheet cell → a tier, for Bulk Import.
 *
 * ACCEPTS THE SHORT WORD AS WELL AS THE ENUM NAME, case-insensitively, and
 * that is not laxness: the person filling this column is typing into a
 * spreadsheet, and `MEDIUM_FORMAT` is a database identifier leaking into an
 * owner's tool. "Large", "medium", "small" are the words the brief itself
 * uses. Anything else returns null and the validator reports the row rather
 * than guessing — the same shape as `parseBool`, which the importer already
 * reads this way.
 *
 * An EMPTY cell also returns null. The importer distinguishes them by
 * checking the raw string first, exactly as it does for `in_stock`: empty
 * means "no opinion", so an update never clobbers a tier the owner set in
 * the studio.
 */
export function parseSizeTierCell(
  raw: string | null | undefined,
): ProductSizeTier | null {
  const value = raw?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!value) return null;
  for (const tier of PRODUCT_SIZE_TIERS) {
    if (value === tier || value === tier.replace("_FORMAT", "")) return tier;
  }
  return null;
}

/** The accepted spellings, for the importer's error message and its docs. */
export const SIZE_TIER_CELL_VALUES = PRODUCT_SIZE_TIERS.flatMap((tier) => [
  tier.replace("_FORMAT", ""),
  tier,
]).join(", ");

/**
 * The storefront's URL value for a tier — `?sizeTier=large` — the short
 * word, lowercase, DERIVED so the list still lives once. Customer words in
 * a shareable URL, not database identifiers: `?sizeTier=LARGE_FORMAT` is
 * the same objection `parseSizeTierCell` records for a spreadsheet cell.
 */
export type SizeTierSlug = "large" | "medium" | "small";

export const SIZE_TIER_SLUG = Object.fromEntries(
  PRODUCT_SIZE_TIERS.map((tier) => [
    tier,
    tier.replace("_FORMAT", "").toLowerCase(),
  ]),
) as Record<ProductSizeTier, SizeTierSlug>;

/**
 * Slug → tier; anything else → undefined, so an unknown facet value adds
 * no clause — the rule `band` already follows in `buildProductWhere`.
 * Exact match only, no case folding: `?sizeTier=LARGE_FORMAT` must not
 * become a second public spelling of the same URL.
 */
export function sizeTierFromSlug(
  value: string | null | undefined,
): ProductSizeTier | undefined {
  if (!value) return undefined;
  return PRODUCT_SIZE_TIERS.find((tier) => SIZE_TIER_SLUG[tier] === value);
}
