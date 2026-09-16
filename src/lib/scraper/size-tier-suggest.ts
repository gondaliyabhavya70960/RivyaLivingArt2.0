import {
  PRODUCT_SIZE_TIERS,
  type ProductSizeTier,
} from "@/lib/product-size-tier";
import { normalizeUnit } from "@/lib/scraper/normalize";

/**
 * Best-effort SUGGESTION of a product's size tier — the owner's three-tier
 * architecture (docs/plan/07, step 6) — from what a scraped listing says
 * about itself: its title, source category, product type, description and
 * free-text dimensions. Pure and deterministic (keyword scoring plus one
 * dimension heuristic), in the shape of `category-map.ts`, so it runs
 * server-side per row at READ time and the operator overrides it in the
 * list before importing.
 *
 * Three things it deliberately is not:
 *
 * - It is never STORED. "No column of its own until it earns one": the
 *   source page computes it beside `matchCategoryId`, the Add-to-catalog
 *   dialog carries the operator's final pick, and only the resulting
 *   `Product.sizeTier` is written. A `ScrapedProduct.suggestedSizeTier`
 *   column is exactly what the plan forbids, and every push here migrates
 *   production.
 * - The SOURCE's tier is not an input. `ScrapeSource.tier` is which supplier
 *   list we went looking in; a large-format studio sells coasters too
 *   (docs/plan/07 §"Scraper"). `size-tier-suggest.test.ts` reads this file's
 *   source and fails if `ScrapeTier` ever appears in it.
 * - It never guesses. Nothing scoring, or two tiers tied at the top, returns
 *   null — the one departure from `matchCategoryId`'s first-wins, because a
 *   coin flip between Memory and Personal is the administrator's call, and
 *   an untiered draft is refused at publish by `describeSizeTierPublishProblem`
 *   rather than shipped under the wrong world.
 */
export type SizeTierSignals = {
  title: string;
  /** Free-text source category (Shopify product_type / first Woo category). */
  category?: string | null;
  /** `fields.productType` when the adapter recorded one (Shopify). */
  productType?: string | null;
  description?: string | null;
  /** Free text, e.g. "48 x 24 in" — parsed, never trusted as structure. */
  dimensions?: string | null;
};

export type SizeTierScores = Record<ProductSizeTier, number>;

/** Any side at or over this pushes LARGE — a table top, a panel, a bench. */
export const LARGE_MIN_CM = 60;
/** A longest side at or under this pushes SMALL — jewellery, charms, magnets. */
export const SMALL_MAX_CM = 10;

/**
 * 3 = a decisive form-factor word (the brief's own examples), 2 = strong,
 * 1 = supporting. Each keyword lives in exactly ONE tier's list — a keyword
 * in two lists is a tie by construction, and the test reads this table off
 * the source to refuse that. "desk" is in no list on purpose: LARGE's brief
 * has no desk and SMALL's has "desk pieces", so the word decides nothing.
 */
type Weighted = readonly [keyword: string, weight: 1 | 2 | 3];

const KEYWORDS: Record<ProductSizeTier, readonly Weighted[]> = {
  LARGE_FORMAT: [
    ["dining table", 3],
    ["coffee table", 3],
    ["side table", 3],
    ["console table", 3],
    ["center table", 3],
    ["centre table", 3],
    ["end table", 3],
    ["river table", 3],
    ["epoxy table", 3],
    ["resin table", 3],
    ["table top", 3],
    ["tabletop", 3],
    ["bar counter", 3],
    ["countertop", 3],
    ["counter top", 3],
    ["dining", 3],
    ["console", 3],
    ["bench", 3],
    ["chair", 3],
    ["stool", 3],
    ["seating", 3],
    ["sofa", 3],
    ["furniture", 3],
    ["wall panel", 3],
    ["wall installation", 3],
    ["installation", 3],
    ["large wall", 3],
    ["sculpture", 3],
    ["mural", 3],
    ["partition", 3],
    ["headboard", 3],
    ["table", 1],
    ["large", 1],
    ["floor", 1],
  ],
  MEDIUM_FORMAT: [
    ["varmala", 3],
    ["var mala", 3],
    ["jaimala", 3],
    ["flower preservation", 3],
    ["bouquet preservation", 3],
    ["preservation", 3],
    ["preserved", 3],
    ["preserve", 3],
    ["garland", 3],
    ["bouquet", 3],
    ["haldi", 3],
    ["wall clock", 3],
    ["clock", 3],
    ["engagement tray", 3],
    ["ring tray", 3],
    ["ring platter", 3],
    ["engagement", 3],
    ["wedding", 3],
    ["anniversary", 3],
    ["invitation", 3],
    ["wedding card", 3],
    ["photo frame", 3],
    ["wedding frame", 3],
    ["nameplate", 3],
    ["name plate", 3],
    ["keepsake", 3],
    ["memory", 3],
    ["memorial", 3],
    ["baby", 3],
    ["footprint", 3],
    ["handprint", 3],
    ["pooja", 3],
    ["frame", 2],
    ["tray", 2],
    ["platter", 2],
    ["wall hanging", 1],
    ["wall art", 1],
  ],
  SMALL_FORMAT: [
    ["rakhi", 3],
    ["rakhee", 3],
    ["rakhdi", 3],
    ["jewellery", 3],
    ["jewelry", 3],
    ["earring", 3],
    ["pendant", 3],
    ["necklace", 3],
    ["bracelet", 3],
    ["bangle", 3],
    ["ring", 3],
    ["brooch", 3],
    ["hair clip", 3],
    ["hairpin", 3],
    ["keychain", 3],
    ["key chain", 3],
    ["keyring", 3],
    ["key ring", 3],
    ["bookmark", 3],
    ["magnet", 3],
    ["fridge magnet", 3],
    ["coaster", 3],
    ["paperweight", 3],
    ["pen stand", 3],
    ["pen holder", 3],
    ["cufflink", 3],
    ["phone grip", 3],
    ["bag charm", 3],
    ["charm", 3],
    ["badge", 3],
    ["corporate gift", 3],
    ["return gift", 3],
    ["gift set", 3],
    ["gifting", 3],
    ["hamper", 3],
    ["diwali", 2],
    ["festive", 2],
    ["gift", 2],
    ["candle", 2],
    ["tea light", 2],
    ["tealight", 2],
    ["ornament", 2],
    ["trinket", 2],
    ["mini", 2],
    ["tiny", 2],
    ["small", 1],
    ["set of", 1],
  ],
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Matcher = { tier: ProductSizeTier; weight: number; re: RegExp };

/**
 * Built once. Longest keyword first, so "dining table" is seen before
 * "table" and "ring tray" before "ring"; whole words only, with an optional
 * plural, so "string" never scores "ring" and "earrings" scores as itself.
 */
const MATCHERS: readonly Matcher[] = PRODUCT_SIZE_TIERS.flatMap((tier) =>
  KEYWORDS[tier].map(([keyword, weight]) => ({
    tier,
    weight,
    re: new RegExp(`\\b${escapeRegExp(keyword)}(?:s|es)?\\b`, "i"),
  })),
).sort((a, b) => b.re.source.length - a.re.source.length);

function emptyScores(): SizeTierScores {
  return { LARGE_FORMAT: 0, MEDIUM_FORMAT: 0, SMALL_FORMAT: 0 };
}

/**
 * Score one field. A matched keyword is CONSUMED — blanked out of the
 * working text — so a phrase and the words inside it never both score:
 * "photo frame keychain" is one MEDIUM hit and one SMALL hit, not MEDIUM
 * twice. That consumption is what keeps the weights honest, and the test
 * pins it ("Engagement Ring Tray" is Memory, not a tie).
 */
function scoreField(text: string): SizeTierScores {
  const scores = emptyScores();
  let working = text.toLowerCase();
  for (const { tier, weight, re } of MATCHERS) {
    if (re.test(working)) {
      scores[tier] += weight;
      working = working.replace(re, " ");
    }
  }
  return scores;
}

function addScaled(into: SizeTierScores, from: SizeTierScores, factor: number) {
  for (const tier of PRODUCT_SIZE_TIERS) into[tier] += from[tier] * factor;
}

const UNIT_TO_CM: Record<string, number> = {
  mm: 0.1,
  cm: 1,
  in: 2.54,
  inchmark: 2.54,
  ft: 30.48,
};

/**
 * The longest side, in centimetres, that a free-text dimensions string
 * declares — or null when it declares none. A chain of numbers joined by
 * x / × / * / by whose LAST number carries a unit gives every number in the
 * chain that unit ("10 x 12 in" → both inches). No unit, no number: "set of
 * 6", "24 x 36" and a bare ring size all yield null, which is the guard —
 * this reads prose a seller typed, never a column.
 *
 * `bareInches` decides whether a lone "in" counts as a unit. It does in a
 * dimensions field ("48 x 24 in"); it does not in a title, where "in" is
 * mostly the preposition ("2 in gift box") and only "inch"/"inches"/`"`
 * mean length.
 */
export function parseMaxDimensionCm(
  raw: string | null | undefined,
  options: { bareInches?: boolean } = {},
): number | null {
  if (!raw || !raw.trim()) return null;
  // An explicit inch — the word or the mark — is a length wherever it sits.
  // It is marked BEFORE normalizeUnit folds "inches" into the same "in" a
  // preposition would leave, so the two can still be told apart below.
  const marked = raw
    .replace(/(\d)\s*(?:"|″|”)/g, "$1 inchmark")
    .replace(/(\d)\s*(?:'|′|’)(?!\w)/g, "$1 ft")
    .replace(/\b(?:inch|inches|ins)\b/gi, "inchmark");
  const text = normalizeUnit(marked);
  if (!text) return null;
  const unit = options.bareInches ? "cm|mm|ft|inchmark|in" : "cm|mm|ft|inchmark";
  const chain = new RegExp(
    `(\\d+(?:\\.\\d+)?(?:\\s*(?:x|×|\\*|by)\\s*\\d+(?:\\.\\d+)?)*)\\s*(${unit})\\b`,
    "gi",
  );
  let max: number | null = null;
  for (const match of text.matchAll(chain)) {
    const factor = UNIT_TO_CM[match[2].toLowerCase()];
    for (const number of match[1].split(/\s*(?:x|×|\*|by)\s*/i)) {
      const cm = Number.parseFloat(number) * factor;
      if (Number.isFinite(cm) && cm > 0 && (max === null || cm > max)) {
        max = Math.round(cm * 100) / 100;
      }
    }
  }
  return max;
}

/**
 * Every tier's score for a listing. Curated fields outrank prose, the same
 * idea as `category-map.ts`: title, category and product type count double,
 * the description once. A product type equal to the category is Shopify
 * writing one string to two fields and is counted once.
 */
export function scoreSizeTiers(input: SizeTierSignals): SizeTierScores {
  const scores = emptyScores();
  const category = input.category?.trim() ?? "";
  const productType = input.productType?.trim() ?? "";

  if (input.title.trim()) addScaled(scores, scoreField(input.title), 2);
  if (category) addScaled(scores, scoreField(category), 2);
  if (productType && productType.toLowerCase() !== category.toLowerCase()) {
    addScaled(scores, scoreField(productType), 2);
  }
  if (input.description?.trim()) {
    addScaled(scores, scoreField(input.description), 1);
  }

  // The dimension push. A dimensions field first; the title as a fallback
  // ("12 inch wall clock" is how many Indian sellers write a size). The
  // description is NEVER parsed for size: "ships in 30 days" and "24 x 7
  // support" live there.
  const maxCm =
    parseMaxDimensionCm(input.dimensions, { bareInches: true }) ??
    parseMaxDimensionCm(input.title);
  if (maxCm !== null) {
    if (maxCm >= LARGE_MIN_CM) scores.LARGE_FORMAT += 6;
    else if (maxCm <= SMALL_MAX_CM) scores.SMALL_FORMAT += 4;
    // The band clocks, trays and frames live in. A decisive keyword (3 × 2)
    // still outranks it, so "side table · 45 cm" stays LARGE.
    else scores.MEDIUM_FORMAT += 2;
  }
  return scores;
}

/**
 * The suggested tier, or null when nothing scores or the top two tie.
 */
export function suggestSizeTier(
  input: SizeTierSignals,
): ProductSizeTier | null {
  const scores = scoreSizeTiers(input);
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
  return tied ? null : best;
}
