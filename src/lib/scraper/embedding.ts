/**
 * Product embeddings (B9, plan §4 phase 8) — the computation, kept pure so
 * every number is unit-testable against literals.
 *
 * What a "similar product" means here is decided by THIS file, in the open:
 * a fixed recipe of weighted features (title tokens, category, alias-resolved
 * materials, league, price band, option-label tokens) is feature-hashed into
 * a 512-dimensional signed vector and L2-normalized. The embedder has a name
 * (`attr-hash`) and a version, both stamped on every stored row, because the
 * day a semantic model replaces this recipe, the old vectors must be
 * recognizable as a different generation — a silent change to what a vector
 * MEANS is the same dishonesty rule 7 forbids in a score.
 *
 * Why a feature hash and not an AI model call: there is no AI key in this
 * deployment, and inventing one would make every similarity number depend on
 * an external service's mood. The hash is deterministic, offline, and — the
 * part rule 7 cares about — every vector's `features` list is stored next to
 * it, so the owner can read exactly what made two pieces "similar".
 *
 * Scope decision, stated: v1 embeds IDENTITY TEXT (what the piece is and
 * what it is made of), not images. Visual similarity wants a real vision
 * model; that is a new `model` value on the same table, not a bolt-on here.
 * Dimensions-in-millimetres likewise wait for the geometry parser — the
 * recipe takes what the corpus reliably has.
 *
 * Pure module: no db, no fetch.
 */
import { createHash } from "node:crypto";

/** The embedder's name, stamped on every row. */
export const EMBEDDING_MODEL = "attr-hash";

/** Bump when the feature recipe or hashing below changes in any way. */
export const EMBEDDING_VERSION = 1;

/** Fixed vector length — the pgvector column is declared `vector(512)`. */
export const EMBEDDING_DIMENSIONS = 512;

/**
 * Cross-source pairs at or above this cosine similarity are surfaced as
 * duplicate candidates. Deliberately high: a false "these two are the same
 * piece" costs the owner a mis-filed product, a missed one costs nothing —
 * the pair stays findable as ordinary neighbours.
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;

/** How many nearest neighbours the Studio lists per focus product. */
export const NEIGHBOUR_LIMIT = 5;

/** A feature is a namespaced token and the weight it votes with. */
export type WeightedFeature = {
  feature: string;
  weight: number;
};

/**
 * What one product contributes to its embedding. Everything optional beyond
 * the title; the caller (embedding-query.ts) has already alias-resolved
 * `materials` and `category`, so the vector reflects the owner's vocabulary,
 * not the source's spelling — a mapping fix improves embeddings on the next
 * recompute, no re-scrape (B4's rule, extended).
 */
export type EmbeddingInput = {
  title: string;
  category: string | null;
  /** Canonical material names, already alias-resolved. */
  materials: string[];
  /** The product's analytics league — same-league pieces are neighbours. */
  league: string;
  /** Reference price in paise (B6's pick), or null for quote-only/unpriced —
   *  null contributes NO price feature, never a zero band. */
  referencePriceMinor: number | null;
  /** Variant labels from the latest snapshot ("Small / Blue"). */
  optionLabels: string[];
};

/** English stopwords plus scraping noise — tokens that say nothing about
 *  what a piece IS. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "at", "buy", "by", "for", "from", "in", "is",
  "it", "its", "made", "new", "of", "on", "online", "or", "our", "the",
  "to", "with", "without",
]);

/** Tokens that survive: lowercase alnum runs of 3+ chars, minus stopwords. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * The coarse INR band a paise price falls into, as a stable token. Bands are
 * wide on purpose — price is a neighbourhood hint, not an identity — and
 * null prices produce NO band, so quote-only pieces are neither forced into
 * the cheapest band nor excluded from embedding.
 */
export function priceBand(priceMinor: number | null): string | null {
  if (priceMinor === null) return null;
  const major = priceMinor / 100;
  if (major < 1_000) return "under-1k";
  if (major < 5_000) return "1k-5k";
  if (major < 20_000) return "5k-20k";
  if (major < 60_000) return "20k-60k";
  if (major < 150_000) return "60k-150k";
  return "over-150k";
}

/**
 * The canonical weighted-feature list for one product — the working the
 * stored `features` JSON records verbatim. Order is fixed and the list is
 * sorted before hashing, so the hash is a pure function of content.
 */
export function canonicalFeatures(input: EmbeddingInput): WeightedFeature[] {
  const features: WeightedFeature[] = [];

  for (const token of new Set(tokenize(input.title))) {
    features.push({ feature: `t:${token}`, weight: 1 });
  }
  if (input.category) {
    for (const token of new Set(tokenize(input.category))) {
      features.push({ feature: `cat:${token}`, weight: 2 });
    }
  }
  for (const material of input.materials) {
    for (const token of new Set(tokenize(material))) {
      features.push({ feature: `m:${token}`, weight: 2.5 });
    }
  }
  if (input.league) {
    features.push({ feature: `l:${input.league.toLowerCase()}`, weight: 1.5 });
  }
  const band = priceBand(input.referencePriceMinor);
  if (band) {
    features.push({ feature: `p:${band}`, weight: 1 });
  }
  const optionTokens = new Set<string>();
  for (const label of input.optionLabels.slice(0, 20)) {
    for (const token of tokenize(label)) optionTokens.add(token);
  }
  for (const token of optionTokens) {
    features.push({ feature: `o:${token}`, weight: 0.75 });
  }

  return features;
}

/**
 * sha1 of the canonical feature JSON (sorted), 16 hex chars — the change
 * key on every stored row. A recompute compares hashes and rewrites only
 * products whose identity text actually moved.
 */
export function embeddingHash(features: WeightedFeature[]): string {
  const canonical = [...features].sort((a, b) =>
    a.feature.localeCompare(b.feature),
  );
  return createHash("sha1")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Feature-hash the weighted features into a signed 512-dimensional vector,
 * L2-normalized so cosine similarity is a dot product (and so pgvector's
 * `<=>` cosine operator agrees with `cosine` below to storage precision).
 *
 * Returns null when there are no features at all — a product with no usable
 * identity text gets NO embedding, and the recompute report counts it as
 * excluded, rather than storing a zero vector that sits at distance 1 from
 * everything and means nothing.
 */
export function embedFeatures(features: WeightedFeature[]): number[] | null {
  if (features.length === 0) return null;
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const { feature, weight } of features) {
    const digest = createHash("sha1").update(feature).digest();
    const index = digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    const sign = digest[4] & 1 ? 1 : -1;
    vector[index] += sign * weight;
  }
  const norm = Math.sqrt(vector.reduce((a, v) => a + v * v, 0));
  if (norm === 0) return null; // every contribution cancelled out — no signal
  return vector.map((v) => v / norm);
}

/**
 * Cosine similarity of two normalized vectors — a dot product. Exported for
 * tests (including the db test that proves pgvector's operator agrees with
 * this arithmetic on stored vectors).
 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

/** Serialize a vector for a `$n::vector` parameter — 6 decimals keeps the
 *  string small and the stored value within ~1e-6 of the computed one. */
export function vectorToLiteral(vector: number[]): string {
  return `[${vector.map((v) => v.toFixed(6)).join(",")}]`;
}
