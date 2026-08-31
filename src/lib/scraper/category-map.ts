/**
 * Best-effort mapping of a scraped product's free-text source category (and
 * title) to one of the store's catalog categories. Pure + deterministic
 * (keyword scoring), so it runs server-side per product and the operator can
 * override the result in the UI. Returns the matched category id, or null when
 * nothing scores — the caller then falls back to an operator-chosen category.
 */
export type CatalogCategory = { id: string; name: string; slug: string };

/** Curated keyword sets per catalog slug — higher coverage than name words alone. */
const KEYWORDS: Record<string, string[]> = {
  "resin-furniture-surfaces": [
    "furniture", "table", "desk", "surface", "countertop", "river table",
    "stool", "shelf", "chair", "console",
  ],
  "art-craft-pieces": [
    "art", "craft", "painting", "wall art", "artwork", "canvas", "portrait",
  ],
  "varmala-preservation": [
    "varmala", "garland", "preservation", "preserved", "haldi", "flower preservation",
  ],
  "wedding-photo-frames": ["frame", "photo frame", "picture frame", "photo", "frames"],
  "resin-trays-serving-platters": ["tray", "platter", "serving", "trays"],
  "candle-tea-light-holders": [
    "candle", "tea light", "tealight", "votive", "candle holder", "tlight",
  ],
  "resin-wall-clocks": ["clock", "wall clock", "clocks"],
  "resin-jewelry-keychains": [
    "jewelry", "jewellery", "pendant", "earring", "necklace", "bracelet",
    "ring", "keychain", "key chain", "keyring", "brooch", "bookmark",
  ],
  "resin-home-decor": [
    "decor", "home decor", "accessory", "ornament", "showpiece", "wall hanging",
    "nameplate", "name plate", "fridge magnet", "magnet", "coaster set",
  ],
  "resin-vases": ["vase", "planter", "pot", "flower pot", "bud vase", "vases"],
  "drinkware-barware": [
    "coaster", "coasters", "mug", "cup", "glass", "bottle", "bar", "drinkware",
    "tumbler", "shot glass", "wine",
  ],
  "tablespace-sets": ["tablespace", "table set", "dinner set", "place setting", "table mat"],
  "sculptures-objets": ["sculpture", "figurine", "statue", "objet", "bust", "idol", "figure"],
  "vanity-mirrors": ["mirror", "vanity", "mirrors"],
  "kids-room-decor": ["kids", "baby", "nursery", "child", "toy", "children"],
  workshops: ["workshop", "class", "course", "kit"],
};

/** Split a phrase into lowercase word tokens for name-word matching. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

/**
 * Score `text` (source category + title) against a catalog category. Source
 * category words weigh more than title words; curated keyword hits weigh most.
 */
function scoreCategory(
  category: CatalogCategory,
  sourceCat: string,
  title: string,
): number {
  const cat = sourceCat.toLowerCase();
  const ttl = title.toLowerCase();
  let score = 0;

  for (const kw of KEYWORDS[category.slug] ?? []) {
    if (cat.includes(kw)) score += 6;
    else if (ttl.includes(kw)) score += 2;
  }

  // Generic: the category's own name words appearing in the source category.
  for (const nameWord of words(category.name)) {
    if (cat.includes(nameWord)) score += 3;
    else if (ttl.includes(nameWord)) score += 1;
  }

  return score;
}

/**
 * Return the best-matching category id for a scraped product, or null when
 * nothing scores above zero.
 */
export function matchCategoryId(
  sourceCategory: string | null | undefined,
  title: string,
  categories: CatalogCategory[],
): string | null {
  const sourceCat = sourceCategory ?? "";
  if (!sourceCat && !title) return null;

  let best: { id: string; score: number } | null = null;
  for (const category of categories) {
    const score = scoreCategory(category, sourceCat, title);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: category.id, score };
    }
  }
  return best?.id ?? null;
}
