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

  it("a re-slug updates canonicalUrl without creating a second identity", async () => {
    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
    await upsertPageForTest(jobId, SOURCE, [
      product({
        title: "Resin Coaster Set — Indigo",
        priceMin: 1499,
        url: "https://example.test/p/1-indigo",
      }),
    ]);
    const all = await db!.researchProduct.findMany({ where: { sourceKey: SOURCE } });
    expect(all).toHaveLength(1);
    expect(all[0].canonicalUrl).toBe("https://example.test/p/1-indigo");
  });
});
