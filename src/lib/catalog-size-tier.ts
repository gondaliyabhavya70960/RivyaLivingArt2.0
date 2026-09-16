import {
  PRODUCT_SIZE_TIERS,
  type ProductSizeTier,
} from "@/lib/product-size-tier";
import { scoreSizeTiers } from "@/lib/scraper/size-tier-suggest";

/**
 * The size tier a CATALOGUE row belongs to, suggested from what the row
 * already says — docs/plan/07 step 3's backlog, worked by rule instead of by
 * hand, row by row, for a catalogue of ~4,400.
 *
 * Three facts shape the rule, all measured on the live catalogue's local
 * mirror on 2026-09-16:
 *
 * - **Most of the catalogue is not a piece.** ~3,000 of the 4,385 rows are
 *   the CSV fill's supplies pools — molds, pigments, resins, filaments,
 *   printer parts — and a further few hundred are supplies mis-filed under a
 *   piece category ("2:1 Resin Hardener 1.5 Kg" under Resin Home Decor,
 *   "Mirror B2 40gms" under Vanity Mirrors, "Black Clock Hand Design 1"
 *   under Resin Wall Clocks). A mold is not Personal Art & Gifting. Those
 *   rows stay UNTIERED, deliberately: the three tiers are three customer
 *   intents for finished work, and there is no fourth value for "not a
 *   piece" — adding one is the owner's call (a T-question), not this rule's.
 * - **The category is the owner's own filing**, and for most categories it
 *   IS the tier: the brief's "typical work" column names wall clocks and
 *   wedding frames as Memory, coasters and keychains as Personal, tables
 *   and sculptures as Collectible. `CATEGORY_SIZE_TIER` is that column,
 *   slug by slug. Three categories are left without a default because
 *   they mix worlds (Resin Home Decor, Resin Vases, Kids Room Decor).
 * - **A decisive word in the row itself outranks the category.** Step 6's
 *   classifier (`size-tier-suggest.ts`, the brief's own vocabulary) scores
 *   the title, description and dimensions; a top score of `DECISIVE_SCORE`
 *   or more — one form-factor word in the title, or a ≥ 60 cm side —
 *   decides, so "Engagement Ring Tray" filed under coasters is Memory and a
 *   48-inch panel under home decor is Collectible. Below that, the category
 *   default decides; with neither, a word of title strength
 *   (`WEAK_MIN_SCORE`) decides Memory or Personal, never Collectible; with
 *   nothing at all, or a tie, the row stays untiered for a person.
 *
 * Measured on the local mirror after these rules (2026-09-16): of 4,385
 * untiered rows, ~570 are filed (13 Collectible · ~125 Memory · ~430
 * Personal), ~3,480 are supplies by category or by title, and ~330 stay
 * untiered for a person — nearly all of them Resin Home Decor rows whose
 * titles say nothing about form ("Get Well Soon!", "Oreo Wafers"). The
 * db test and `scripts/` carry no copy of these numbers; a re-run of the
 * plan against the mirror is how they are refreshed.
 *
 * Pure. The write side (`catalog-size-tier-backfill.ts`) adds the two rules
 * about WHICH rows: never one that already has a tier, never one a person
 * has edited (`ownerTouched`), never a demo row.
 */

/**
 * The categories whose pieces count as large-format work — the ratified set
 * `/large-resin-art` has classified by since the page existed (formerly
 * declared in `large-format.ts`, which re-exports it).
 */
export const LARGE_FORMAT_CATEGORY_SLUGS = [
  "resin-furniture-surfaces",
  "sculptures-objets",
  "art-craft-pieces",
] as const;

/**
 * Categories that hold no pieces at all: the CSV fill's supplies pools and
 * the workshop sessions (a booking is not a piece — the demo fixtures made
 * the same call). Every row in them stays untiered whatever its title says.
 */
export const SUPPLY_CATEGORY_SLUGS = [
  "supplies-molds-tools",
  "supplies-pigments",
  "supplies-resin",
  "print-filaments",
  "print-hardware",
  "workshops",
] as const;

/**
 * The brief's "typical work" column, as the owner's category slugs. A slug
 * absent here has no default and is decided by the row's own words alone.
 */
export const CATEGORY_SIZE_TIER: Readonly<Record<string, ProductSizeTier>> = {
  "resin-furniture-surfaces": "LARGE_FORMAT",
  "sculptures-objets": "LARGE_FORMAT",
  "art-craft-pieces": "LARGE_FORMAT",

  "varmala-preservation": "MEDIUM_FORMAT",
  "wedding-photo-frames": "MEDIUM_FORMAT",
  "resin-wall-clocks": "MEDIUM_FORMAT",
  "vanity-mirrors": "MEDIUM_FORMAT",

  // Trays and platters are Memory in step 6's vocabulary ("engagement/ring
  // trays" in the brief; `tray` and `platter` score MEDIUM there), so the
  // category says the same rather than fighting its own rows.
  "resin-trays-serving-platters": "MEDIUM_FORMAT",

  "resin-jewelry-keychains": "SMALL_FORMAT",
  "tablespace-sets": "SMALL_FORMAT",
  "drinkware-barware": "SMALL_FORMAT",
  "gift-collections": "SMALL_FORMAT",
  "festive-pooja": "SMALL_FORMAT",
  "candle-tea-light-holders": "SMALL_FORMAT",
  "print-decor": "SMALL_FORMAT",
};

/**
 * A title that names a material, a tool, a component or a lesson rather
 * than a piece. Read against the TITLE only — a description may say
 * "sealed with resin" of a finished table — and against the mis-filings the
 * catalogue actually contains, not a dictionary: molds and cavities, pigments
 * and hardeners, brushes and tools, filaments and printer parts, clock
 * hands, bezels and chains for jewellery-making, tuition, and anything
 * sold by weight or volume ("40gms", "1.5 Kg", "150ml"). The direction of
 * error is chosen: a piece caught by this list stays untiered for a person;
 * a material that slips past it would be filed under a customer intent it
 * does not belong to.
 */
export const SUPPLY_TITLE_PATTERNS: readonly RegExp[] = [
  /\bmou?lds?\b/i,
  /\bcavit(?:y|ies)\b/i,
  /\bpigments?\b/i,
  /\bmica\b/i,
  /\bhardeners?\b/i,
  /\bresin\s+(?:kit|art\s+kit|craft\s+kit|starter)\b/i,
  /\bcraft\s+kits?\b/i,
  /\binks?\s+sets?\b/i,
  /\bbrush(?:es)?\b/i,
  /\btools?\b/i,
  /\bfilaments?\b/i,
  /\bspools?\b/i,
  /\bnozzles?\b/i,
  /\bbearings?\b/i,
  /\bextruders?\b/i,
  /\btuition\b/i,
  /\bmasterclass\b/i,
  /\bworkshops?\b/i,
  /\bclock\s+hands?\b/i,
  /\bbezels?\b/i,
  /\bchains?\s+for\b/i,
  /\b(?:bracelet|jewell?ery|resin|candle|art)\s+making\b/i,
  /\bfindings\b/i,
  /\bdried\s+flowers?\b/i,
  /\brefills?\b/i,
  /\badhesives?\b/i,
  /\bsandpaper\b/i,
  /\bsealant\b/i,
  /\bprimer\b/i,
  /\broman\s+num(?:ber|eral)s?\b/i,
  /\bhand\s+design\b/i,
  /\bbeads?\b/i,
  /\bpollens?\b/i,
  /\btapes?\b/i,
  /\bthermometers?\b/i,
  /\buv\s+lamps?\b/i,
  /\blamp\s+bases?\b/i,
  /\bmdf\b.*\b(?:base|board|surface|blank|sheet)s?\b/i,
  /\bsilicone\b/i,
  /\b\d+\s*pcs?\b/i,
  /\bpearls?\b/i,
  /\bpipe\s+cleaners?\b/i,
  /\bpacking\s+cards?\b/i,
  /\b\d+(?:\.\d+)?\s*(?:gms?|grams?|kgs?|ml|litres?|liters?)\b/i,
];

/** Whether a title names a supply rather than a piece. */
export function isSupplyTitle(title: string): boolean {
  return SUPPLY_TITLE_PATTERNS.some((re) => re.test(title));
}

/**
 * The score at which the row's own words outrank its category: one
 * form-factor word of weight 3 in the title (3 × 2), or a ≥ 60 cm side (6).
 */
export const DECISIVE_SCORE = 6;

/**
 * The least a row's words may score and still decide a tier when its
 * category has no default: a weight-2 word in the title ("gift", "candle",
 * "tray" — 2 × 2), or two such words in the description. Below it — one
 * supporting word, one weight-3 word mentioned only in prose — the row
 * stays untiered for a person. Collectible is never decided this way at
 * all: "table", "large" and "floor" are its only supporting words, and a
 * coaster filed under Collectible is the costliest error the storefront
 * can render (the collectible card, the commission CTA).
 */
export const WEAK_MIN_SCORE = 4;

export type CatalogTierRow = {
  title: string;
  description?: string | null;
  dimensions?: string | null;
  categorySlug: string | null;
  categoryName?: string | null;
};

export type CatalogTierReason =
  | "supply-category"
  | "supply-title"
  | "keyword"
  | "category"
  | "weak-keyword"
  | "tie"
  | "none";

export type CatalogTierSuggestion = {
  tier: ProductSizeTier | null;
  reason: CatalogTierReason;
  /** The winning tier's score, for the log line. */
  score: number;
};

/** The suggested tier for one catalogue row, with the rule that decided it. */
export function suggestCatalogSizeTier(
  row: CatalogTierRow,
): CatalogTierSuggestion {
  const slug = row.categorySlug ?? "";
  if ((SUPPLY_CATEGORY_SLUGS as readonly string[]).includes(slug)) {
    return { tier: null, reason: "supply-category", score: 0 };
  }
  if (isSupplyTitle(row.title))
    return { tier: null, reason: "supply-title", score: 0 };

  // The category NAME is deliberately not scored: it enters the decision
  // once, through `CATEGORY_SIZE_TIER`. Scoring it as well double-counted
  // the owner's filing ("Festive & Pooja" read as Memory through "pooja")
  // and let a category outvote the row's own words.
  const scores = scoreSizeTiers({
    title: row.title,
    description: row.description ?? null,
    dimensions: row.dimensions ?? null,
  });
  let best: ProductSizeTier | null = null;
  let bestScore = 0;
  let tied = false;
  for (const tier of PRODUCT_SIZE_TIERS) {
    const score = scores[tier];
    if (score > bestScore) {
      best = tier;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }

  // The row's own words outrank the owner's filing only when the row says
  // nothing for the category's tier, or beats it by a decisive margin: a
  // "Candle Bouquet" under candle holders carries a Memory word and a
  // Personal word, and that ambiguity is the owner's to settle — the
  // category settles it. "Engagement Ring Tray" under keychains carries no
  // Personal word at all, and moves.
  const byCategory = CATEGORY_SIZE_TIER[slug];
  if (best && !tied && bestScore >= DECISIVE_SCORE) {
    const rival = byCategory && byCategory !== best ? scores[byCategory] : 0;
    if (bestScore - rival >= DECISIVE_SCORE)
      return { tier: best, reason: "keyword", score: bestScore };
  }
  if (byCategory)
    return { tier: byCategory, reason: "category", score: bestScore };
  if (best && !tied && bestScore >= WEAK_MIN_SCORE && best !== "LARGE_FORMAT")
    return { tier: best, reason: "weak-keyword", score: bestScore };
  return { tier: null, reason: tied ? "tie" : "none", score: bestScore };
}
