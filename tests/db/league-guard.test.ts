import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * The league guard, against a real Postgres (B6).
 *
 * Pure tests can prove the where-fragments' SHAPE; only a database can prove
 * the two halves meet — that a variant stamped `isReference` by the write
 * path is the same row the guard's clause excludes, and that an average run
 * through the guard stays unpolluted by it. That meeting point is the whole
 * rule: a coaster is never benchmarked against a dining table.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const SOURCE = "league-guard-test";

function product(overrides: Partial<RichProduct> = {}): RichProduct {
  return {
    externalId: "ext-1",
    url: "https://example.test/p/1",
    sourceKey: SOURCE,
    vertical: "resin",
    currency: "INR",
    title: "Pigment Paste",
    slug: "pigment-paste",
    priceMin: 499,
    images: [],
    imageAlts: [],
    fields: {},
    ...overrides,
  };
}

describe.skipIf(!db)("analytics league guard", () => {
  let jobId: string;

  beforeAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE } });
    // The source row carries the league classification the guard reads. Any
    // leftover from a previous run is re-leagued rather than duplicated.
    await db.scrapeSource.upsert({
      where: { key: SOURCE },
      create: {
        key: SOURCE,
        name: SOURCE,
        baseUrl: "https://example.test",
        tier: "SUPPLIES",
        analyticsLeague: "MATERIALS_DIY",
      },
      update: { analyticsLeague: "MATERIALS_DIY" },
    });
    const source = await db.scrapeSource.findUniqueOrThrow({
      where: { key: SOURCE },
      select: { id: true },
    });
    const job = await db.scrapeJob.create({
      data: {
        source: { connect: { id: source.id } },
        sourceKey: SOURCE,
        sourceName: SOURCE,
        vertical: "RESIN",
        platform: "SHOPIFY",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: "https://example.test",
      },
      select: { id: true },
    });
    jobId = job.id;
  });

  // Leave the shared database as this suite found it (the convention the
  // older suites already follow): league-wide medians in analytics.test.ts
  // read EVERY source, so a suite that leaves priced rows behind moves
  // another suite's numbers on the next run.
  afterAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapeJob.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapeSource.deleteMany({ where: { key: SOURCE } });
  });

  it("a MATERIALS_DIY scrape stamps every variant isReference with its league reason", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, SOURCE, [product()], "MATERIALS_DIY");

    const variants = await db!.productVariant.findMany({
      where: { snapshot: { researchProduct: { sourceKey: SOURCE } } },
    });
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      expect(v.isReference).toBe(true);
      expect(v.referenceReason).toBe("league:MATERIALS_DIY");
    }
  });

  it("a FINISHED_ART scrape of the same product leaves variants comparable", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    // Force a second snapshot: a moved price changes the content hash.
    await upsertPageForTest(
      jobId,
      SOURCE,
      [product({ priceMin: 549 })],
      "FINISHED_ART",
    );

    const latest = await db!.productSnapshot.findFirstOrThrow({
      where: { researchProduct: { sourceKey: SOURCE } },
      orderBy: { capturedAt: "desc" },
      include: { variants: true },
    });
    for (const v of latest.variants) {
      expect(v.isReference).toBe(false);
      expect(v.referenceReason).toBeNull();
    }
  });

  it("the query guard resolves a league to its source keys", async () => {
    const { sourceKeysForLeague } = await import(
      "@/lib/scraper/league-query"
    );
    const keys = await sourceKeysForLeague("MATERIALS_DIY");
    expect(keys).toContain(SOURCE);
    const finished = await sourceKeysForLeague("FINISHED_ART");
    expect(finished).not.toContain(SOURCE);
  });

  it("an average through the guard is unpolluted by reference rows — BY CLAUSE, not by filtering after", async () => {
    const { sourceKeysForLeague } = await import(
      "@/lib/scraper/league-query"
    );
    const { variantWhereForLeague } = await import("@/lib/scraper/leagues");

    // The source is a MATERIALS_DIY source: the FINISHED_ART benchmark over
    // its keys sees nothing, however many cheap pigment prices it holds.
    const diyKeys = await sourceKeysForLeague("MATERIALS_DIY");
    const artAvg = await db!.productVariant.aggregate({
      where: variantWhereForLeague(
        (await sourceKeysForLeague("FINISHED_ART")).filter(
          (k) => k === SOURCE,
        ),
      ),
      _avg: { priceMinor: true },
    });
    expect(artAvg._avg.priceMinor).toBeNull();

    // And inside its own league, the reference stamp still excludes it.
    // The source holds two snapshots by now: the ₹499 row written under
    // MATERIALS_DIY (stamped reference) and the ₹549 row the previous test
    // wrote under FINISHED_ART (comparable). An average that equals the
    // comparable row's price EXACTLY is the proof: the ₹499 reference row
    // was kept out by the clause, not averaged in and filtered after. (The
    // first version of this test expected null, which would only be true
    // if the comparable row did not exist — it does, two tests up.)
    const diyAvg = await db!.productVariant.aggregate({
      where: variantWhereForLeague(diyKeys.filter((k) => k === SOURCE)),
      _avg: { priceMinor: true },
      _count: { priceMinor: true },
    });
    expect(diyAvg._count.priceMinor).toBe(1);
    expect(diyAvg._avg.priceMinor).toBe(54900);
  });
});
