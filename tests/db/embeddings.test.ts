import { beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import {
  cosine,
  DUPLICATE_SIMILARITY_THRESHOLD,
  embedFeatures,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  type WeightedFeature,
} from "@/lib/scraper/embedding";
import type { EmbeddingRecomputeReport } from "@/lib/scraper/embedding-query";
import { ShortlistState } from "@/lib/scraper/shortlist";
import { transitionEntries } from "@/lib/scraper/shortlist-write";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * The B9 embedding round-trip, against a real Postgres with pgvector.
 *
 * Pure tests prove the recipe; only a database can prove the two halves
 * meet — that the vector pgvector stores is the vector the pure module
 * computed (the extension's cosine operator agrees with the module's own
 * arithmetic), that the hash skip makes a second recompute a no-op, and that
 * an owner alias edit moves an embedding without a re-scrape (B4's rule,
 * extended to vectors).
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL. CI's Postgres
 * is pgvector/pgvector:pg16 — the migration's CREATE EXTENSION needs it.
 */
const db = await getTestDb();

const ART = "embed-test-art";
const ART2 = "embed-test-art2";
const DIY = "embed-test-diy";

function product(
  sourceKey: string,
  overrides: Partial<RichProduct> = {},
): RichProduct {
  return {
    externalId: "ext-1",
    url: `https://example.test/${sourceKey}/1`,
    sourceKey,
    vertical: "resin",
    currency: "INR",
    title: "Blue River Console Table",
    slug: "blue-river-console-table",
    priceMin: 60000,
    materials: "epoxy resin, acacia wood",
    images: [],
    imageAlts: [],
    fields: {},
    ...overrides,
  };
}

async function researchProductId(
  sourceKey: string,
  externalId: string,
): Promise<string> {
  const row = await db!.researchProduct.findUniqueOrThrow({
    where: { sourceKey_externalId: { sourceKey, externalId } },
    select: { id: true },
  });
  return row.id;
}

async function recompute(): Promise<EmbeddingRecomputeReport> {
  const { recomputeEmbeddings } = await import(
    "@/lib/scraper/embedding-query"
  );
  return recomputeEmbeddings();
}

async function vectorOf(
  sourceKey: string,
  externalId: string,
): Promise<number[]> {
  const id = await researchProductId(sourceKey, externalId);
  const row = await db!.productEmbedding.findUniqueOrThrow({
    where: {
      researchProductId_model: {
        researchProductId: id,
        model: EMBEDDING_MODEL,
      },
    },
    select: { features: true },
  });
  const vector = embedFeatures(row.features as unknown as WeightedFeature[]);
  if (!vector) throw new Error("expected an embedding");
  return vector;
}

describe.skipIf(!db)("embeddings + similarity", () => {
  let firstReport: EmbeddingRecomputeReport;

  beforeAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({
      where: { sourceKey: { in: [ART, ART2, DIY] } },
    });
    await db.scrapedProduct.deleteMany({
      where: { sourceKey: { in: [ART, ART2, DIY] } },
    });

    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");

    // Two sources listing the same console in near-identical words (the
    // duplicate-candidate case), and one supplies source with nothing in
    // common (the control).
    const sources: Array<{
      key: string;
      league: "FINISHED_ART" | "MATERIALS_DIY";
      tier: "LARGE_FORMAT" | "SUPPLIES";
      products: RichProduct[];
    }> = [
      { key: ART, league: "FINISHED_ART", tier: "LARGE_FORMAT", products: [product(ART)] },
      {
        key: ART2,
        league: "FINISHED_ART",
        tier: "LARGE_FORMAT",
        products: [
          product(ART2, {
            externalId: "ext-9",
            url: "https://example.test/art2/9",
            title: "Blue River Console Table — Handmade",
            slug: "blue-river-console-table-handmade",
            priceMin: 62000,
          }),
        ],
      },
      {
        key: DIY,
        league: "MATERIALS_DIY",
        tier: "SUPPLIES",
        products: [
          product(DIY, {
            externalId: "ext-pigment",
            url: "https://example.test/diy/pigment",
            title: "Pigment Paste",
            slug: "pigment-paste",
            priceMin: 500,
            materials: "epoxy pigment",
          }),
        ],
      },
    ];

    for (const source of sources) {
      await db.scrapeSource.upsert({
        where: { key: source.key },
        create: {
          key: source.key,
          name: source.key,
          baseUrl: "https://example.test",
          tier: source.tier,
          analyticsLeague: source.league,
        },
        update: { analyticsLeague: source.league },
      });
      const row = await db.scrapeSource.findUniqueOrThrow({
        where: { key: source.key },
        select: { id: true },
      });
      const job = await db.scrapeJob.create({
        data: {
          source: { connect: { id: row.id } },
          sourceKey: source.key,
          sourceName: source.key,
          vertical: "RESIN",
          platform: "SHOPIFY",
          scope: "SOURCE",
          status: "RUNNING",
          inputUrl: "https://example.test",
        },
        select: { id: true },
      });
      await upsertPageForTest(job.id, source.key, source.products, source.league);
    }
  });

  it("recompute embeds every product with signal, stamped model · version · dims · hash", async () => {
    firstReport = await recompute();
    expect(firstReport.considered).toBeGreaterThanOrEqual(3);
    expect(
      firstReport.written + firstReport.unchanged + firstReport.noSignal,
    ).toBe(firstReport.considered);
    expect(firstReport.model).toBe(EMBEDDING_MODEL);
    expect(firstReport.version).toBe(EMBEDDING_VERSION);
    expect(firstReport.dimensions).toBe(EMBEDDING_DIMENSIONS);

    for (const [sourceKey, externalId] of [
      [ART, "ext-1"],
      [ART2, "ext-9"],
      [DIY, "ext-pigment"],
    ] as const) {
      const id = await researchProductId(sourceKey, externalId);
      const row = await db!.productEmbedding.findUniqueOrThrow({
        where: {
          researchProductId_model: {
            researchProductId: id,
            model: EMBEDDING_MODEL,
          },
        },
      });
      expect(row.version).toBe(EMBEDDING_VERSION);
      expect(row.dimensions).toBe(EMBEDDING_DIMENSIONS);
      expect(row.hash).toMatch(/^[0-9a-f]{16}$/);
      expect(Array.isArray(row.features)).toBe(true);
    }
  });

  it("the stored vector is a pgvector column of the declared dimension", async () => {
    const id = await researchProductId(ART, "ext-1");
    const rows = await db!.$queryRaw<Array<{ dims: number }>>`
      SELECT vector_dims(vector) AS dims
      FROM "ProductEmbedding"
      WHERE "researchProductId" = ${id} AND model = ${EMBEDDING_MODEL}
    `;
    expect(rows[0]?.dims).toBe(EMBEDDING_DIMENSIONS);
  });

  it("pgvector's cosine operator agrees with the module's own arithmetic", async () => {
    const aId = await researchProductId(ART, "ext-1");
    const bId = await researchProductId(ART2, "ext-9");
    const [a, b] = await Promise.all([
      vectorOf(ART, "ext-1"),
      vectorOf(ART2, "ext-9"),
    ]);
    const expected = cosine(a, b);

    const rows = await db!.$queryRaw<Array<{ similarity: number }>>`
      SELECT 1 - (a.vector <=> b.vector) AS similarity
      FROM "ProductEmbedding" a, "ProductEmbedding" b
      WHERE a."researchProductId" = ${aId} AND b."researchProductId" = ${bId}
        AND a.model = ${EMBEDDING_MODEL} AND b.model = ${EMBEDDING_MODEL}
    `;
    // Stored vectors are 6-decimal literals — agreement within 1e-3.
    expect(rows[0]?.similarity).toBeCloseTo(expected, 3);
  });

  it("a second recompute with no changes is a no-op — the hash skip works", async () => {
    const second = await recompute();
    expect(second.written).toBe(0);
    expect(second.unchanged).toBe(
      firstReport.considered - firstReport.noSignal,
    );
    expect(second.prunedGenerations).toBe(0);
  });

  it("the cross-source twin surfaces as a duplicate candidate; the pigment does not", async () => {
    const { similarityPageData } = await import(
      "@/lib/scraper/embedding-query"
    );
    const data = await similarityPageData();

    expect(data.computedAt).not.toBeNull();
    expect(data.embeddedCount).toBe(
      firstReport.considered - firstReport.noSignal,
    );
    expect(data.embeddedCount).toBeLessThanOrEqual(data.productCount);

    const aId = await researchProductId(ART, "ext-1");
    const bId = await researchProductId(ART2, "ext-9");
    const diyId = await researchProductId(DIY, "ext-pigment");

    const pair = data.duplicateCandidates.find(
      (c) =>
        (c.aId === aId && c.bId === bId) || (c.aId === bId && c.bId === aId),
    );
    expect(pair).toBeDefined();
    expect(pair!.similarity).toBeGreaterThanOrEqual(
      DUPLICATE_SIMILARITY_THRESHOLD,
    );

    const crossLeague = data.duplicateCandidates.find(
      (c) =>
        (c.aId === aId && c.bId === diyId) ||
        (c.aId === diyId && c.bId === aId),
    );
    expect(crossLeague).toBeUndefined();
  });

  it("an owner alias edit moves the embedding — a mapping fix needs no re-scrape (B4, extended)", async () => {
    const id = await researchProductId(ART, "ext-1");
    const before = await db!.productEmbedding.findUniqueOrThrow({
      where: {
        researchProductId_model: {
          researchProductId: id,
          model: EMBEDDING_MODEL,
        },
      },
      select: { hash: true },
    });

    await db!.normalizationAlias.create({
      data: {
        kind: "MATERIAL",
        rawValue: "acacia wood",
        canonicalValue: "sheesham",
      },
    });
    try {
      const report = await recompute();
      expect(report.written).toBeGreaterThanOrEqual(1);
      const after = await db!.productEmbedding.findUniqueOrThrow({
        where: {
          researchProductId_model: {
            researchProductId: id,
            model: EMBEDDING_MODEL,
          },
        },
        select: { hash: true, features: true },
      });
      expect(after.hash).not.toBe(before.hash);
      const features = after.features as unknown as WeightedFeature[];
      expect(features.some((f) => f.feature === "m:sheesham")).toBe(true);
    } finally {
      await db!.normalizationAlias.deleteMany({
        where: { kind: "MATERIAL", rawValue: "acacia wood" },
      });
      await recompute(); // restore the un-aliased generation
    }
  });

  it("a shortlisted piece lists its nearest neighbours, twin first", async () => {
    const id = await researchProductId(ART, "ext-1");
    await transitionEntries([id], ShortlistState.SHORTLISTED, {
      changedBy: "user-1",
    });

    const { similarityPageData } = await import(
      "@/lib/scraper/embedding-query"
    );
    const data = await similarityPageData();
    const focus = data.focus.find((f) => f.researchProductId === id);
    expect(focus).toBeDefined();
    expect(focus!.neighbours.length).toBeGreaterThan(0);

    const bId = await researchProductId(ART2, "ext-9");
    expect(focus!.neighbours[0].researchProductId).toBe(bId);
    expect(focus!.neighbours[0].similarity).toBeGreaterThanOrEqual(
      DUPLICATE_SIMILARITY_THRESHOLD,
    );
  });

  it("deleting a product cascades its embedding — the index never points at a ghost", async () => {
    const id = await researchProductId(DIY, "ext-pigment");
    await db!.researchProduct.delete({ where: { id } });
    expect(
      await db!.productEmbedding.count({ where: { researchProductId: id } }),
    ).toBe(0);
  });
});
