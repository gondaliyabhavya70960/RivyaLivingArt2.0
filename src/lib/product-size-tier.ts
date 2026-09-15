import type { ContentStatus, ProductSizeTier } from "@/generated/prisma/enums";

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
