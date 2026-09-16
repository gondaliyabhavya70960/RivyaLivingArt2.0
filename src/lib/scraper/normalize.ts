/**
 * Free-text cleanup for a staged row, applied once at the point it lands in
 * `ScrapedProduct` — before `contentHash` — so a source's own inconsistency
 * ("Epoxy resin" one week, "epoxy Resin" the next, "resin, resin, wood")
 * never manufactures a false content change, and so the review grid and the
 * catalog it feeds show one vocabulary rather than a hundred sources' worth
 * of spelling.
 *
 * `contentHash` (hash.ts) is deliberately narrow — title, prices, status,
 * images — and none of these normalizers touch any of those four fields:
 * `normalizeMaterial`/`normalizeUnit` land on `materials`/`dimensions`,
 * `normalizeColour` lands on a colour attribute inside `fields`, and
 * `canonicalizeUrl` lands on `url`. So applying them here changes NOTHING
 * `contentHash` reads, and `NORMALIZER_VERSION` (prisma/import-tiers.ts's
 * constant, a different pipeline) does not need bumping for this change —
 * said explicitly because the plan asked the question, and the honest
 * answer only holds as long as these functions stay off title/price/status/
 * images. Touch one of those later and the version DOES need bumping.
 *
 * Pure module — no database, no fetch — so every alias table is unit-tested
 * directly.
 */

/**
 * The scraper pipeline's own normalizer version (B8), stamped on every
 * `AnalyticsSnapshot` as `normalizerVersion`. Deliberately NOT
 * import-tiers.ts's `NORMALIZER_VERSION` — that constant versions the sheet
 * pipeline's tier inference, a different pipeline reading different fields.
 *
 * Bump when any function in this file changes what it outputs: analytics
 * read staged rows and snapshot variants through these mappings, so a
 * mapping change without a bump would leave old snapshots claiming the new
 * reading. A bump requires no re-scrape — compute-time normalization (B4)
 * re-reads `rawPayload` — but it does require a recompute.
 */
export const SCRAPER_NORMALIZER_VERSION = "n1";

/** Split a delimited phrase into trimmed, non-empty tokens. `/` and `&` are
 *  treated as separators alongside the obvious comma — "wood/resin" and
 *  "gold & silver" are two items, not one. */
function tokens(raw: string): string[] {
  return raw
    .split(/[,/&]|(?:\band\b)/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function titleCase(word: string): string {
  return word.replace(/\S+/g, (part) =>
    part === part.toUpperCase() && part.length <= 4
      ? part // short all-caps tokens (e.g. "MDF", "3D") stay as-is
      : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
  );
}

/** Material vocabulary, source spelling → the catalogue's canonical form. */
const MATERIAL_ALIASES: Record<string, string> = {
  "epoxy resin": "Epoxy Resin",
  "epoxy-resin": "Epoxy Resin",
  epoxy: "Epoxy Resin",
  resin: "Resin",
  "uv resin": "UV Resin",
  wood: "Wood",
  woods: "Wood",
  mdf: "MDF",
  plywood: "Plywood",
  acrylic: "Acrylic",
  glass: "Glass",
  metal: "Metal",
  brass: "Brass",
  copper: "Copper",
  steel: "Steel",
  "stainless steel": "Stainless Steel",
  silver: "Silver",
  "sterling silver": "Sterling Silver",
  gold: "Gold",
  "gold plated": "Gold Plated",
  "gold-plated": "Gold Plated",
  "rose gold": "Rose Gold",
  wire: "Wire",
  silicone: "Silicone",
  clay: "Clay",
  fabric: "Fabric",
  cotton: "Cotton",
  velvet: "Velvet",
  marble: "Marble",
  concrete: "Concrete",
  paper: "Paper",
  ceramic: "Ceramic",
  crystal: "Crystal",
  glitter: "Glitter",
  pigment: "Pigment",
  "mica powder": "Mica Powder",
};

/** Colour vocabulary — a source's own attribute, not a `RichProduct` field
 *  (see the module note): shades and finish words alongside plain hues. */
const COLOUR_ALIASES: Record<string, string> = {
  clear: "Clear",
  transparent: "Clear",
  white: "White",
  ivory: "Ivory",
  cream: "Cream",
  black: "Black",
  charcoal: "Charcoal",
  grey: "Grey",
  gray: "Grey",
  brown: "Brown",
  tan: "Tan",
  beige: "Beige",
  gold: "Gold",
  golden: "Gold",
  "rose gold": "Rose Gold",
  "rose-gold": "Rose Gold",
  silver: "Silver",
  copper: "Copper",
  bronze: "Bronze",
  red: "Red",
  maroon: "Maroon",
  pink: "Pink",
  fuchsia: "Pink",
  orange: "Orange",
  yellow: "Yellow",
  mustard: "Mustard",
  green: "Green",
  olive: "Olive",
  teal: "Teal",
  turquoise: "Turquoise",
  blue: "Blue",
  navy: "Navy",
  purple: "Purple",
  lavender: "Lavender",
  violet: "Violet",
  multicolor: "Multicolour",
  multicolour: "Multicolour",
  "multi-color": "Multicolour",
  "multi-colour": "Multicolour",
};

/** Unit vocabulary, matched as a whole word so "in" never eats "inlay". */
const UNIT_ALIASES: Record<string, string> = {
  inches: "in",
  inch: "in",
  ins: "in",
  centimeters: "cm",
  centimetres: "cm",
  centimeter: "cm",
  centimetre: "cm",
  millimeters: "mm",
  millimetres: "mm",
  millimeter: "mm",
  millimetre: "mm",
  feet: "ft",
  foot: "ft",
  grams: "g",
  gram: "g",
  gm: "g",
  gms: "g",
  kilograms: "kg",
  kilogram: "kg",
  kgs: "kg",
};

const UNIT_PATTERN = new RegExp(
  `\\b(${Object.keys(UNIT_ALIASES)
    .sort((a, b) => b.length - a.length)
    .join("|")})\\b`,
  "gi",
);

/**
 * Normalize a materials phrase against `MATERIAL_ALIASES`: split on the
 * usual separators, alias each token (case-insensitively) or fall back to
 * title-casing an unknown one, dedupe, rejoin with ", ". `null`/empty input
 * stays `null` — there is nothing to normalize into a phrase.
 */
export function normalizeMaterial(
  raw: string | null | undefined,
): string | null {
  if (!raw || !raw.trim()) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens(raw)) {
    const canonical = MATERIAL_ALIASES[token.toLowerCase()] ?? titleCase(token);
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out.length > 0 ? out.join(", ") : null;
}

/**
 * Normalize a colour phrase against `COLOUR_ALIASES`, same shape as
 * `normalizeMaterial`. Used on a `colour`/`color` attribute pulled out of a
 * scraped row's free-form `fields`, not a dedicated `RichProduct` column —
 * source platforms carry it as a variant/attribute, not a top-level field.
 */
export function normalizeColour(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens(raw)) {
    const canonical = COLOUR_ALIASES[token.toLowerCase()] ?? titleCase(token);
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out.length > 0 ? out.join(", ") : null;
}

/**
 * Normalize unit WORDS inside a free-text dimensions string — "10 x 12
 * inches" → "10 x 12 in" — without touching anything else in the phrase
 * (the numbers, the "x", stray descriptive words). Unlike
 * `normalizeMaterial`/`normalizeColour` this is a token REPLACE over the
 * whole string, not a split-and-rejoin: dimensions is prose ("approx. 10 x
 * 12 in, gift-boxed"), not a delimited list.
 */
export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const replaced = raw.replace(
    UNIT_PATTERN,
    (match) => UNIT_ALIASES[match.toLowerCase()] ?? match,
  );
  return replaced.trim() || null;
}

/** Query params that carry tracking noise, never product identity. Matched
 *  by prefix for the utm_ family, exactly for the rest. */
const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_NAMES = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "_ga",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    TRACKING_PARAM_NAMES.has(lower) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
}

/**
 * Canonical form of a scraped URL: lowercase host, tracking params stripped,
 * the remaining query sorted, no trailing slash on the path. Two URLs that
 * differ only in campaign noise ("?utm_source=ig" today, none tomorrow)
 * canonicalize identically. Malformed input is returned unchanged — a URL
 * `new URL()` cannot parse is not this function's problem to solve, and
 * silently mangling it would be worse than leaving it alone.
 */
export function canonicalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  url.hostname = url.hostname.toLowerCase();

  const kept: [string, string][] = [...url.searchParams.entries()].filter(
    ([name]) => !isTrackingParam(name),
  );
  kept.sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [name, value] of kept) url.searchParams.append(name, value);

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}
