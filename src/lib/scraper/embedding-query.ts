/**
 * Embedding read/write assembly (B9) — server-only. The pure computation
 * lives in `embedding.ts` (feature recipe, hashing, cosine); this module
 * fetches the corpus those functions embed, persists vectors through
 * pgvector, and reads similarity back through pgvector's own operators.
 *
 * Two deliberate shapes:
 *
 * 1. The `vector` column is `Unsupported("vector(512)")` — Prisma never
 *    models it. Writes are `$executeRaw` upserts with a `::vector` cast;
 *    reads are `$queryRaw` with the `<=>` cosine operator. The plan's rule
 *    is honoured literally: the index and the operator are pgvector's, not
 *    hand-rolled.
 *
 * 2. Recompute is explicit (a Studio action, never a scrape, never a cron)
 *    and incremental BY HASH: a product whose identity text did not move
 *    keeps its row — the `computedAt` it carries is the last time its vector
 *    actually changed, which is the honest provenance. Rows from other
 *    model/version generations are pruned wholesale: embeddings are
 *    derivations, not dated records (D24 protects what a source said, not
 *    what we derived from it).
 */
import { randomUUID } from "node:crypto";

import { AliasKind, ShortlistState } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolveWithMap, type AliasMap } from "@/lib/scraper/alias-resolver";
import {
  pickReferenceVariant,
  type ScopedVariantRow,
} from "@/lib/scraper/comparison-scopes";
import {
  canonicalFeatures,
  embedFeatures,
  embeddingHash,
  DUPLICATE_SIMILARITY_THRESHOLD,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  NEIGHBOUR_LIMIT,
  vectorToLiteral,
  type EmbeddingInput,
} from "@/lib/scraper/embedding";
import { BENCHMARK_LEAGUE } from "@/lib/scraper/leagues";

/** Split a free-text materials string ("epoxy resin, acacia wood") into
 *  raw material phrases for alias resolution. */
function splitMaterials(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;+/]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type EmbeddingRecomputeReport = {
  computedAt: Date;
  model: string;
  version: number;
  dimensions: number;
  /** Products looked at. */
  considered: number;
  /** Rows rewritten because the feature hash moved (or the row was new). */
  written: number;
  /** Rows kept because the hash matched — the incremental skip. */
  unchanged: number;
  /** Products with no usable identity text — NO embedding stored. */
  noSignal: number;
  /** Rows pruned from other model/version generations. */
  prunedGenerations: number;
};

/**
 * Embed every researched product whose identity text carries signal.
 * Every product is eligible — embeddings are an index, not a
 * recommendation, and the duplicate-candidate read exists precisely for
 * products nobody has reviewed yet.
 */
export async function recomputeEmbeddings(): Promise<EmbeddingRecomputeReport> {
  const computedAt = new Date();

  const [products, twins, sources, materialMap, latestSnapshots] =
    await Promise.all([
      db.researchProduct.findMany({
        select: { id: true, sourceKey: true, externalId: true },
      }),
      db.scrapedProduct.findMany({
        select: {
          sourceKey: true,
          externalId: true,
          title: true,
          category: true,
          materials: true,
        },
      }),
      db.scrapeSource.findMany({
        select: { key: true, name: true, analyticsLeague: true },
      }),
      // Read directly rather than through the cached `getAliasMap`: a
      // recompute is a rare explicit action and must see the owner's
      // aliases as they stand NOW, not as an hour-old cache entry.
      db.normalizationAlias
        .findMany({
          where: { kind: AliasKind.MATERIAL },
          select: { rawValue: true, canonicalValue: true },
        })
        .then((rows): AliasMap => {
          const map: AliasMap = {};
          for (const row of rows) map[row.rawValue] = row.canonicalValue;
          return map;
        }),
      db.productSnapshot.findMany({
        orderBy: { capturedAt: "desc" },
        distinct: ["researchProductId"],
        include: { variants: true },
      }),
    ]);

  const twinByPair = new Map(
    twins.map((t) => [`${t.sourceKey} ${t.externalId}`, t]),
  );
  const leagueBySource = new Map(sources.map((s) => [s.key, s.analyticsLeague]));
  const snapshotByProduct = new Map(
    latestSnapshots.map((s) => [s.researchProductId, s]),
  );

  const existing = await db.productEmbedding.findMany({
    where: { model: EMBEDDING_MODEL },
    select: { researchProductId: true, hash: true, version: true },
  });
  const existingByProduct = new Map(
    existing.map((e) => [e.researchProductId, e]),
  );

  type PendingRow = {
    researchProductId: string;
    hash: string;
    featuresJson: string;
    vectorLiteral: string;
  };
  const pending: PendingRow[] = [];
  const noSignalIds: string[] = [];
  let unchanged = 0;

  for (const product of products) {
    const twin = twinByPair.get(`${product.sourceKey} ${product.externalId}`);
    const snapshot = snapshotByProduct.get(product.id);
    const rows: ScopedVariantRow[] = (snapshot?.variants ?? []).map((v) => ({
      snapshotId: v.snapshotId,
      researchProductId: product.id,
      capturedAt: snapshot?.capturedAt ?? new Date(0),
      label: v.label,
      priceMinor: v.priceMinor,
      priceBasis: v.priceBasis,
      isReference: v.isReference,
    }));
    // The price band comes from B6's reference-variant pick — the same row
    // the benchmarks and the opportunity score read, so "similar" and
    // "comparable" never drift apart.
    const pick = pickReferenceVariant(rows);

    const input: EmbeddingInput = {
      title: twin?.title ?? "",
      category: twin?.category ?? null,
      materials: splitMaterials(twin?.materials ?? null).map((m) =>
        resolveWithMap(materialMap, AliasKind.MATERIAL, m),
      ),
      league:
        leagueBySource.get(product.sourceKey) ?? BENCHMARK_LEAGUE,
      referencePriceMinor: pick?.row.priceMinor ?? null,
      optionLabels: rows
        .map((r) => r.label)
        .filter((l): l is string => l !== null),
    };

    const features = canonicalFeatures(input);
    const vector = embedFeatures(features);
    if (!vector) {
      noSignalIds.push(product.id);
      continue;
    }
    const hash = embeddingHash(features);
    const prior = existingByProduct.get(product.id);
    if (
      prior &&
      prior.hash === hash &&
      prior.version === EMBEDDING_VERSION
    ) {
      unchanged += 1;
      continue;
    }
    pending.push({
      researchProductId: product.id,
      hash,
      featuresJson: JSON.stringify(features),
      vectorLiteral: vectorToLiteral(vector),
    });
  }

  // Embeddings whose product lost all signal are removed — a zero vector
  // would sit at distance 1 from everything and mean nothing.
  if (noSignalIds.length > 0) {
    await db.productEmbedding.deleteMany({
      where: {
        model: EMBEDDING_MODEL,
        researchProductId: { in: noSignalIds },
      },
    });
  }

  // Stale generations (old model or version) are pruned wholesale.
  const pruned = await db.productEmbedding.deleteMany({
    where: { NOT: { model: EMBEDDING_MODEL, version: EMBEDDING_VERSION } },
  });

  await db.$transaction(async (tx) => {
    for (const row of pending) {
      await tx.$executeRaw`
        INSERT INTO "ProductEmbedding"
          ("id", "researchProductId", "model", "version", "hash",
           "dimensions", "features", "vector", "computedAt")
        VALUES (
          ${randomUUID()}, ${row.researchProductId}, ${EMBEDDING_MODEL},
          ${EMBEDDING_VERSION}, ${row.hash}, ${EMBEDDING_DIMENSIONS},
          ${row.featuresJson}::jsonb, ${row.vectorLiteral}::vector,
          ${computedAt}
        )
        ON CONFLICT ("researchProductId", "model") DO UPDATE SET
          "version" = EXCLUDED."version",
          "hash" = EXCLUDED."hash",
          "dimensions" = EXCLUDED."dimensions",
          "features" = EXCLUDED."features",
          "vector" = EXCLUDED."vector",
          "computedAt" = EXCLUDED."computedAt"
      `;
    }
  });

  return {
    computedAt,
    model: EMBEDDING_MODEL,
    version: EMBEDDING_VERSION,
    dimensions: EMBEDDING_DIMENSIONS,
    considered: products.length,
    written: pending.length,
    unchanged,
    noSignal: noSignalIds.length,
    prunedGenerations: pruned.count,
  };
}

// ————————————————————— Page assembly —————————————————————

export type DuplicateCandidate = {
  aId: string;
  bId: string;
  aTitle: string;
  bTitle: string;
  aSourceName: string;
  bSourceName: string;
  aState: ShortlistState;
  bState: ShortlistState;
  /** Cosine similarity in [0,1] — the pgvector `<=>` distance, inverted. */
  similarity: number;
};

export type NeighbourRow = {
  researchProductId: string;
  title: string;
  sourceName: string;
  similarity: number;
};

export type FocusNeighbours = {
  researchProductId: string;
  title: string;
  sourceName: string;
  state: ShortlistState;
  neighbours: NeighbourRow[];
};

export type SimilarityPageData = {
  /** null when nothing has ever been embedded — the section shows the empty
   *  state pointing at the Recompute button. */
  computedAt: Date | null;
  model: string;
  version: number;
  dimensions: number;
  /** The computed-from line: embedded X of N researched products. */
  embeddedCount: number;
  productCount: number;
  duplicateThreshold: number;
  duplicateCandidates: DuplicateCandidate[];
  /** Nearest neighbours for shortlisted/confirmed products. */
  focus: FocusNeighbours[];
};

type PairRow = { aId: string; bId: string; similarity: number };
type NeighbourSqlRow = { id: string; similarity: number };

/**
 * Everything the Similarity section renders. Similarity is read live from
 * pgvector at page load — corpus-small by design — while the vectors
 * themselves only move on the explicit Recompute.
 */
export async function similarityPageData(): Promise<SimilarityPageData> {
  const [embeddings, productCount] = await Promise.all([
    db.productEmbedding.findMany({
      where: { model: EMBEDDING_MODEL, version: EMBEDDING_VERSION },
      select: { researchProductId: true, computedAt: true },
      orderBy: { computedAt: "desc" },
    }),
    db.researchProduct.count(),
  ]);

  const base: SimilarityPageData = {
    computedAt: embeddings[0]?.computedAt ?? null,
    model: EMBEDDING_MODEL,
    version: EMBEDDING_VERSION,
    dimensions: EMBEDDING_DIMENSIONS,
    embeddedCount: embeddings.length,
    productCount,
    duplicateThreshold: DUPLICATE_SIMILARITY_THRESHOLD,
    duplicateCandidates: [],
    focus: [],
  };
  if (embeddings.length === 0) return base;

  const [products, twins, sources] = await Promise.all([
    db.researchProduct.findMany({
      select: {
        id: true,
        sourceKey: true,
        externalId: true,
        canonicalUrl: true,
        shortlistEntry: { select: { state: true } },
      },
    }),
    db.scrapedProduct.findMany({
      select: { sourceKey: true, externalId: true, title: true },
    }),
    db.scrapeSource.findMany({ select: { key: true, name: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const twinByPair = new Map(
    twins.map((t) => [`${t.sourceKey} ${t.externalId}`, t]),
  );
  const sourceNameByKey = new Map(sources.map((s) => [s.key, s.name]));

  const displayOf = (id: string) => {
    const product = productById.get(id);
    if (!product) {
      return { title: id, sourceName: "—", state: ShortlistState.NEW };
    }
    const twin = twinByPair.get(`${product.sourceKey} ${product.externalId}`);
    return {
      title: twin?.title ?? product.canonicalUrl,
      sourceName: sourceNameByKey.get(product.sourceKey) ?? product.sourceKey,
      state: product.shortlistEntry?.state ?? ShortlistState.NEW,
    };
  };

  // Duplicate candidates: cross-source pairs at or above the threshold.
  // `>` on ids keeps each unordered pair once.
  const pairs = await db.$queryRaw<PairRow[]>`
    SELECT
      a."researchProductId" AS "aId",
      b."researchProductId" AS "bId",
      1 - (a.vector <=> b.vector) AS similarity
    FROM "ProductEmbedding" a
    JOIN "ProductEmbedding" b
      ON b.model = a.model AND b.version = a.version
     AND b."researchProductId" > a."researchProductId"
    JOIN "ResearchProduct" ra ON ra.id = a."researchProductId"
    JOIN "ResearchProduct" rb ON rb.id = b."researchProductId"
    WHERE a.model = ${EMBEDDING_MODEL} AND a.version = ${EMBEDDING_VERSION}
      AND ra."sourceKey" <> rb."sourceKey"
      AND a.vector <=> b.vector <= ${1 - DUPLICATE_SIMILARITY_THRESHOLD}
    ORDER BY a.vector <=> b.vector ASC
    LIMIT 50
  `;
  base.duplicateCandidates = pairs.map((pair) => {
    const a = displayOf(pair.aId);
    const b = displayOf(pair.bId);
    return {
      aId: pair.aId,
      bId: pair.bId,
      aTitle: a.title,
      bTitle: b.title,
      aSourceName: a.sourceName,
      bSourceName: b.sourceName,
      aState: a.state,
      bState: b.state,
      similarity: pair.similarity,
    };
  });

  // Focus neighbours: shortlisted/confirmed products, top NEIGHBOUR_LIMIT
  // each. The focus set is human-gated (rule 8) — the whole corpus is
  // indexed, but "which pieces should the owner compare" is a human list.
  const focusIds = products
    .filter(
      (p) =>
        p.shortlistEntry &&
        (p.shortlistEntry.state === ShortlistState.SHORTLISTED ||
          p.shortlistEntry.state === ShortlistState.CONFIRMED),
    )
    .map((p) => p.id)
    .filter((id) => embeddings.some((e) => e.researchProductId === id));

  for (const id of focusIds) {
    const rows = await db.$queryRaw<NeighbourSqlRow[]>`
      SELECT
        b."researchProductId" AS id,
        1 - (a.vector <=> b.vector) AS similarity
      FROM "ProductEmbedding" a
      JOIN "ProductEmbedding" b
        ON b.model = a.model AND b.version = a.version
       AND b."researchProductId" <> a."researchProductId"
      WHERE a.model = ${EMBEDDING_MODEL} AND a.version = ${EMBEDDING_VERSION}
        AND a."researchProductId" = ${id}
      ORDER BY a.vector <=> b.vector ASC
      LIMIT ${NEIGHBOUR_LIMIT}
    `;
    const focus = displayOf(id);
    base.focus.push({
      researchProductId: id,
      title: focus.title,
      sourceName: focus.sourceName,
      state: focus.state,
      neighbours: rows.map((r) => ({
        researchProductId: r.id,
        title: displayOf(r.id).title,
        sourceName: displayOf(r.id).sourceName,
        similarity: r.similarity,
      })),
    });
  }

  return base;
}
