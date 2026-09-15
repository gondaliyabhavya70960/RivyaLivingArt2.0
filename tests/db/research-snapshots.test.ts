import { beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * The dual-write's contract, against a real Postgres.
 *
 * Pure tests cannot cover this: the whole question is what lands in two tables
 * after three successive scrapes, and the interesting case — an UNCHANGED row
 * writing no snapshot — is invisible to anything that does not count rows.
 *
 * Runs under `npm run test:db` (vitest.db.config.mts), which is the suite that
 * already has a database. Skipped with no DATABASE_URL rather than failing, so
 * the ordinary unit run stays green.
 */
const db = await getTestDb();

const SOURCE = "dualwrite-test";

function product(overrides: Partial<RichProduct> = {}): RichProduct {
  return {
    externalId: "ext-1",
    url: "https://example.test/p/1",
    sourceKey: SOURCE,
    vertical: "resin",
    currency: "INR",
    title: "Resin Coaster Set",
    slug: "resin-coaster-set",
    images: [],
    imageAlts: [],
    fields: {},
    ...overrides,
  };
}

describe.skipIf(!db)("research identity + snapshots", () => {
  let jobId: string;

  beforeAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({ where: { sourceKey: SOURCE } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: SOURCE } });
    const source = await db.scrapeSource.findFirstOrThrow({ select: { id: true } });
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

  async function counts() {
    const identity = await db!.researchProduct.findUnique({
      where: { sourceKey_externalId: { sourceKey: SOURCE, externalId: "ext-1" } },
      select: { id: true, canonicalUrl: true, firstSeen: true, lastSeen: true },
    });
    const snapshots = identity
      ? await db!.productSnapshot.count({ where: { researchProductId: identity.id } })
      : 0;
    return { identity, snapshots };
  }

  it("first sighting creates identity and one snapshot", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, SOURCE, [product()]);
    const { identity, snapshots } = await counts();
    expect(identity).not.toBeNull();
    expect(snapshots).toBe(1);
  });

  it("an UNCHANGED re-scrape writes no second snapshot, but moves lastSeen", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    const before = await counts();
    await new Promise((r) => setTimeout(r, 25));
    await upsertPageForTest(jobId, SOURCE, [product()]);
    const after = await counts();
    expect(after.snapshots).toBe(before.snapshots);
    expect(after.identity!.lastSeen.getTime()).toBeGreaterThan(
      before.identity!.lastSeen.getTime(),
    );
    // firstSeen is never rewritten.
    expect(after.identity!.firstSeen.getTime()).toBe(
      before.identity!.firstSeen.getTime(),
    );
  });

  it("a CHANGED re-scrape appends a snapshot and keeps the old one", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    const before = await counts();
    await upsertPageForTest(jobId, SOURCE, [
      product({ title: "Resin Coaster Set — Indigo", priceMin: 1499 }),
    ]);
    const after = await counts();
    expect(after.snapshots).toBe(before.snapshots + 1);

    const rows = await db!.productSnapshot.findMany({
      where: { researchProductId: after.identity!.id },
      orderBy: { capturedAt: "asc" },
      select: { contentHash: true, rawPayload: true },
    });
    const titles = rows.map(
      (r) => (r.rawPayload as unknown as RichProduct).title,
    );
    // The history is the point: the ORIGINAL title is still readable after the
    // staged row has been overwritten with the new one.
    expect(titles[0]).toBe("Resin Coaster Set");
    expect(titles.at(-1)).toBe("Resin Coaster Set — Indigo");
    expect(new Set(rows.map((r) => r.contentHash)).size).toBe(rows.length);
  });

  it("stores the RAW payload, not the normalized row", async () => {
    // B2 shipped this storing the normalized product and claiming otherwise.
    // The snapshot is meant to be what the SOURCE said — and B4's whole
    // premise (fix a mapping without re-scraping) needs the raw value kept.
    // `normalizeStagedProduct` rewrites `url`, `materials` and `dimensions`,
    // so a value only it would change is the probe.
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, SOURCE, [
      product({
        externalId: "raw-1",
        // A tracking query `canonicalizeUrl` strips, and a unit string
        // `normalizeUnit` rewrites.
        url: "https://example.test/p/raw-1?utm_source=newsletter",
        materials: "epoxy resin, sheesham wood",
        dimensions: "24 inches x 12 inches",
      }),
    ]);
    const identity = await db!.researchProduct.findUniqueOrThrow({
      where: { sourceKey_externalId: { sourceKey: SOURCE, externalId: "raw-1" } },
      select: { id: true },
    });
    const snap = await db!.productSnapshot.findFirstOrThrow({
      where: { researchProductId: identity.id },
      select: { rawPayload: true },
    });
    const payload = snap.rawPayload as unknown as RichProduct;
    expect(payload.url).toBe("https://example.test/p/raw-1?utm_source=newsletter");
    expect(payload.dimensions).toBe("24 inches x 12 inches");
    expect(payload.materials).toBe("epoxy resin, sheesham wood");
  });

  it("a re-slug updates canonicalUrl without creating a second identity", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, SOURCE, [
      product({
        title: "Resin Coaster Set — Indigo",
        priceMin: 1499,
        url: "https://example.test/p/1-indigo",
      }),
    ]);
    // Scoped to this externalId, not the whole source: sibling tests add
    // their own fixtures here, and the claim is about identity NOT forking
    // when a URL changes — not about how many products the source has.
    const all = await db!.researchProduct.findMany({
      where: { sourceKey: SOURCE, externalId: "ext-1" },
    });
    expect(all).toHaveLength(1);
    expect(all[0].canonicalUrl).toBe("https://example.test/p/1-indigo");
  });
});

/**
 * Phase 6b's whole point, against the database: a product a studio quotes on
 * enquiry must land as QUOTE_ONLY with a NULL price — never 0, never absent.
 */
describe.skipIf(!db)("variants and price basis", () => {
  const QUOTE_SOURCE = "quote-only-test";
  let jobId: string;

  beforeAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({ where: { sourceKey: QUOTE_SOURCE } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: QUOTE_SOURCE } });
    const source = await db.scrapeSource.findFirstOrThrow({ select: { id: true } });
    const job = await db.scrapeJob.create({
      data: {
        source: { connect: { id: source.id } },
        sourceKey: QUOTE_SOURCE,
        sourceName: QUOTE_SOURCE,
        vertical: "RESIN",
        platform: "JSONLD",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: "https://example.test",
      },
      select: { id: true },
    });
    jobId = job.id;
  });

  async function variantsFor(externalId: string) {
    const identity = await db!.researchProduct.findUniqueOrThrow({
      where: { sourceKey_externalId: { sourceKey: QUOTE_SOURCE, externalId } },
      select: { id: true },
    });
    const snapshot = await db!.productSnapshot.findFirstOrThrow({
      where: { researchProductId: identity.id },
      orderBy: { capturedAt: "desc" },
      select: { id: true },
    });
    return db!.productVariant.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: { label: "asc" },
      select: { label: true, priceMinor: true, priceBasis: true, optionsJson: true },
    });
  }

  it("a bespoke piece with no price is QUOTE_ONLY with a NULL price, not 0", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, QUOTE_SOURCE, [
      {
        externalId: "bespoke-1",
        url: "https://example.test/p/bespoke",
        sourceKey: QUOTE_SOURCE,
        vertical: "resin",
        currency: "INR",
        title: "Bespoke river dining table",
        slug: "bespoke-river-dining-table",
        description: "Made to order. Price on request.",
        images: [],
        imageAlts: [],
        fields: {},
      },
    ]);
    const rows = await variantsFor("bespoke-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].priceBasis).toBe("QUOTE_ONLY");
    expect(rows[0].priceMinor).toBeNull();
    // The distinction the table exists for.
    expect(rows[0].priceMinor).not.toBe(0);
  });

  it("a priced product keeps one row per option, in minor units", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, QUOTE_SOURCE, [
      {
        externalId: "coaster-1",
        url: "https://example.test/p/coaster",
        sourceKey: QUOTE_SOURCE,
        vertical: "resin",
        currency: "INR",
        title: "Resin Coaster Set",
        slug: "resin-coaster-set",
        priceMin: 1499,
        images: [],
        imageAlts: [],
        fields: {},
        variants: [
          { label: "Set of 2", priceMajor: 1499, options: { Size: "2" } },
          { label: "Set of 4", priceMajor: 2499, options: { Size: "4" } },
        ],
      },
    ]);
    const rows = await variantsFor("coaster-1");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.priceMinor)).toEqual([149900, 249900]);
    expect(rows.every((r) => r.priceBasis === "PER_PIECE")).toBe(true);
    expect(rows[0].optionsJson).toEqual({ Size: "2" });
  });

  it("QUOTE_ONLY is excluded BY CLAUSE, and the average is unpolluted", async () => {
    // The query analytics will run (B8): exclude the basis, never filter zeros.
    const agg = await db!.productVariant.aggregate({
      where: {
        snapshot: { researchProduct: { sourceKey: QUOTE_SOURCE } },
        priceBasis: { not: "QUOTE_ONLY" },
      },
      _avg: { priceMinor: true },
      _count: { _all: true },
    });
    expect(agg._count._all).toBe(2);
    expect(agg._avg.priceMinor).toBe((149900 + 249900) / 2);
  });
});
