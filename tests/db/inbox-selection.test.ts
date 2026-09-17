import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import type { ScrapeTier } from "@/generated/prisma/enums";
import { ShortlistState } from "@/lib/scraper/shortlist";
import {
  INBOX_SIZE_TIER_FILTERS,
  inboxCounts,
  inboxRows,
  inboxSelection,
  suggestedTierOf,
} from "@/lib/scraper/shortlist-query";
import { transitionEntries } from "@/lib/scraper/shortlist-write";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * The review inbox's two tier filters and its selection resolver, against a
 * real Postgres.
 *
 * The SOURCE's tier is a column and the PRODUCT's tier is computed from the
 * twin at read time, so the two filters take different paths — one a where
 * clause, the other a scan of the slice — and only a database shows they
 * agree with the rows the page renders. The resolver is what "select all N
 * matching" acts on: it must hand back every id for a move, the importable
 * subset for the catalogue with the same category auto-map and tier
 * suggestion the source page shows, and never a twin already promoted.
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const LARGE_SOURCE = "inbox-sel-large";
const SMALL_SOURCE = "inbox-sel-small";
const KEYS = [LARGE_SOURCE, SMALL_SOURCE];

/** A category handed straight to the resolver — it maps, it never queries. */
const DINING = { id: "inbox-sel-cat-dining", name: "Dining Tables", slug: "dining-tables" };

function product(sourceKey: string, overrides: Partial<RichProduct>): RichProduct {
  const externalId = overrides.externalId ?? "ext";
  return {
    externalId,
    url: `https://${sourceKey}.test/p/${externalId}`,
    sourceKey,
    vertical: "resin",
    currency: "INR",
    title: "Untitled",
    slug: externalId,
    priceMin: 1000,
    images: [],
    imageAlts: [],
    fields: {},
    ...overrides,
  };
}

// A large-format source that also sells coasters — the reason the two
// filters exist — plus a small-format source with one row.
const TABLE = product(LARGE_SOURCE, {
  externalId: "table",
  slug: "river-dining-table",
  title: "River Dining Table",
  dimensions: "180 x 90 cm",
});
const COASTERS = product(LARGE_SOURCE, {
  externalId: "coasters",
  slug: "resin-coaster-set",
  title: "Resin Coaster Set of 4",
});
const FRAME = product(LARGE_SOURCE, {
  externalId: "frame",
  slug: "varmala-frame",
  title: "Varmala Preservation Frame",
});
const RAKHI = product(SMALL_SOURCE, {
  externalId: "rakhi",
  slug: "resin-rakhi",
  title: "Resin Rakhi Gift Box",
});

function suggestionFor(p: RichProduct) {
  return suggestedTierOf({
    title: p.title,
    category: p.category ?? null,
    description: p.description ?? null,
    dimensions: p.dimensions ?? null,
    fields: p.fields,
  });
}

async function seedSource(key: string, tier: ScrapeTier, products: RichProduct[]) {
  await db!.scrapeSource.upsert({
    where: { key },
    create: { key, name: key, baseUrl: `https://${key}.test`, tier },
    update: { tier },
  });
  const source = await db!.scrapeSource.findUniqueOrThrow({
    where: { key },
    select: { id: true },
  });
  const job = await db!.scrapeJob.create({
    data: {
      source: { connect: { id: source.id } },
      sourceKey: key,
      sourceName: key,
      vertical: "RESIN",
      platform: "SHOPIFY",
      scope: "SOURCE",
      status: "RUNNING",
      inputUrl: `https://${key}.test`,
    },
    select: { id: true },
  });
  const { upsertPageForTest } = await import("@/lib/scraper/job-runner");
  await upsertPageForTest(job.id, key, products);
}

async function researchProductId(sourceKey: string, externalId: string) {
  const row = await db!.researchProduct.findUniqueOrThrow({
    where: { sourceKey_externalId: { sourceKey, externalId } },
    select: { id: true },
  });
  return row.id;
}

async function cleanup() {
  await db!.researchProduct.deleteMany({ where: { sourceKey: { in: KEYS } } });
  await db!.scrapedProduct.deleteMany({ where: { sourceKey: { in: KEYS } } });
  await db!.scrapeJob.deleteMany({ where: { sourceKey: { in: KEYS } } });
  await db!.scrapeSource.deleteMany({ where: { key: { in: KEYS } } });
}

describe.skipIf(!db)("review inbox: tier filters and the selection resolver", () => {
  beforeAll(async () => {
    if (!db) return;
    await cleanup();
    await seedSource(LARGE_SOURCE, "LARGE_FORMAT", [TABLE, COASTERS, FRAME]);
    await seedSource(SMALL_SOURCE, "SMALL_FORMAT", [RAKHI]);
    // Already in the catalogue: the resolver must leave it out.
    await db.scrapedProduct.update({
      where: {
        sourceKey_externalId: { sourceKey: LARGE_SOURCE, externalId: "frame" },
      },
      data: { reviewStatus: "IMPORTED" },
    });
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
  });

  it("the source-tier filter reads the SOURCE, and a source outside the tier matches nothing", async () => {
    const { rows } = await inboxRows({ sourceTier: "LARGE_FORMAT" }, "ALL");
    const ours = rows.filter((row) => KEYS.includes(row.sourceKey));
    expect(new Set(ours.map((row) => row.sourceKey))).toEqual(
      new Set([LARGE_SOURCE]),
    );
    expect(rows.every((row) => row.sourceTier === "LARGE_FORMAT")).toBe(true);

    const mismatch = await inboxRows(
      { sourceKey: LARGE_SOURCE, sourceTier: "SMALL_FORMAT" },
      "ALL",
    );
    expect(mismatch.rows).toEqual([]);
    expect(mismatch.totalMatching).toBe(0);
  });

  it("the suggested-tier filter is computed from the twin over the whole slice, and each row carries its suggestion", async () => {
    // The classifier's own reading of the three seeded rows — the filter
    // must return exactly the rows it would tag, tier by tier. Two of them
    // are pinned outright so the fixture cannot drift into meaninglessness.
    expect(suggestionFor(TABLE)).toBe("LARGE_FORMAT");
    expect(suggestionFor(COASTERS)).toBe("SMALL_FORMAT");
    const expected = new Map(
      [TABLE, COASTERS, FRAME].map((p) => [p.slug, suggestionFor(p)]),
    );

    for (const wanted of INBOX_SIZE_TIER_FILTERS) {
      const target = wanted === "NONE" ? null : wanted;
      const { rows } = await inboxRows(
        { sourceKey: LARGE_SOURCE, sizeTier: wanted },
        "ALL",
      );
      const want = [...expected]
        .filter(([, tier]) => tier === target)
        .map(([slug]) => slug)
        .sort();
      expect(rows.map((row) => row.slug).sort()).toEqual(want);
      expect(rows.every((row) => row.suggestedSizeTier === target)).toBe(true);
    }

    const counts = await inboxCounts({
      sourceKey: LARGE_SOURCE,
      sizeTier: "LARGE_FORMAT",
    });
    expect(counts.NEW).toBe(1);
  });

  it("the resolver hands back every id for a move and the importable subset with category and tier, never a promoted twin", async () => {
    const sel = await inboxSelection(
      { sourceKey: LARGE_SOURCE },
      ShortlistState.NEW,
      { categories: [DINING] },
    );
    expect(sel.ids).toHaveLength(3);
    expect(sel.totalMatching).toBe(3);
    expect(sel.capped).toBe(false);
    expect(sel.alreadyImported).toBe(1);
    expect(sel.noTwin).toBe(0);
    expect(sel.importable.map((row) => row.title).sort()).toEqual(
      [TABLE.title, COASTERS.title].sort(),
    );

    const table = sel.importable.find((row) => row.title === TABLE.title)!;
    expect(table.categoryId).toBe(DINING.id);
    expect(table.suggestedSizeTier).toBe("LARGE_FORMAT");
    const coasters = sel.importable.find((row) => row.title === COASTERS.title)!;
    expect(coasters.categoryId).toBeNull();
    expect(coasters.suggestedSizeTier).toBe("SMALL_FORMAT");
  });

  it("an explicit id list resolves just those rows, and the state filter follows the funnel", async () => {
    const tableId = await researchProductId(LARGE_SOURCE, "table");
    const coastersId = await researchProductId(LARGE_SOURCE, "coasters");

    const explicit = await inboxSelection({}, "ALL", {
      ids: [tableId],
      categories: [DINING],
    });
    expect(explicit.ids).toEqual([tableId]);
    expect(explicit.importable).toHaveLength(1);

    await transitionEntries([coastersId], ShortlistState.REJECTED, {
      changedBy: null,
    });
    const stillNew = await inboxSelection(
      { sourceKey: LARGE_SOURCE },
      ShortlistState.NEW,
      { categories: [] },
    );
    expect(stillNew.ids.sort()).toEqual(
      [tableId, await researchProductId(LARGE_SOURCE, "frame")].sort(),
    );
    const rejected = await inboxSelection(
      { sourceKey: LARGE_SOURCE },
      ShortlistState.REJECTED,
      { categories: [] },
    );
    expect(rejected.ids).toEqual([coastersId]);
  });
});
