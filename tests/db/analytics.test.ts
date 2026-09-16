import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDb } from "./helpers";
import { ANALYTICS_VERSION } from "@/lib/scraper/analytics";
import type {
  ComputedFrom,
  LeaguePriceBenchmarkPayload,
} from "@/lib/scraper/analytics";
import { COMPARISON_SCOPES } from "@/lib/scraper/comparison-scopes";
import { SCRAPER_NORMALIZER_VERSION } from "@/lib/scraper/normalize";
import { OPPORTUNITY_COMPONENTS } from "@/lib/scraper/opportunity";
import { ShortlistState } from "@/lib/scraper/shortlist";
import { transitionEntries } from "@/lib/scraper/shortlist-write";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * The B8 analytics round-trip, against a real Postgres.
 *
 * Pure tests prove the payload math; only a database can prove the two
 * halves meet — that the league guard's WHERE clause is the same boundary
 * the benchmark stands on (a ₹500 pigment paste never reaches a FINISHED_ART
 * median), that every stored payload's accounting closes as SQL, and that a
 * recompute REPLACES the derivation instead of accreting it. That meeting
 * point is the whole rule: every payload carries "computed from X of N".
 *
 * Runs under `npm run test:db`; skipped with no DATABASE_URL.
 */
const db = await getTestDb();

const ART = "analytics-test-art";
const DIY = "analytics-test-diy";

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
    title: "River Console",
    slug: "river-console",
    priceMin: 45000,
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

function benchmarkPayload(value: unknown): LeaguePriceBenchmarkPayload {
  return value as unknown as LeaguePriceBenchmarkPayload;
}

function accountingCloses(cf: ComputedFrom): boolean {
  const excluded = Object.values(cf.exclusions).reduce((a, b) => a + b, 0);
  return cf.included + excluded === cf.considered;
}

describe.skipIf(!db)("analytics + opportunity score", () => {
  let latestJobId: string;

  beforeAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({
      where: { sourceKey: { in: [ART, DIY] } },
    });
    await db.scrapedProduct.deleteMany({
      where: { sourceKey: { in: [ART, DIY] } },
    });

    const { upsertPageForTest } = await import("@/lib/scraper/job-runner");

    // A finished-art competitor: three priced pieces and one quote-only
    // listing. ₹45,000 / ₹60,000 / ₹90,000 — the unique-design median is
    // ₹60,000 (6_000_000 paise).
    await db.scrapeSource.upsert({
      where: { key: ART },
      create: {
        key: ART,
        name: ART,
        baseUrl: "https://example.test",
        tier: "LARGE_FORMAT",
        analyticsLeague: "FINISHED_ART",
      },
      update: { analyticsLeague: "FINISHED_ART" },
    });
    const artSource = await db.scrapeSource.findUniqueOrThrow({
      where: { key: ART },
      select: { id: true },
    });
    const artJob = await db.scrapeJob.create({
      data: {
        source: { connect: { id: artSource.id } },
        sourceKey: ART,
        sourceName: ART,
        vertical: "RESIN",
        platform: "SHOPIFY",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: "https://example.test",
      },
      select: { id: true },
    });
    await upsertPageForTest(
      artJob.id,
      ART,
      [
        product(ART),
        product(ART, {
          externalId: "ext-2",
          url: "https://example.test/art/2",
          title: "Coaster Set",
          slug: "coaster-set",
          priceMin: 60000,
        }),
        product(ART, {
          externalId: "ext-3",
          url: "https://example.test/art/3",
          title: "Dining Table",
          slug: "dining-table",
          priceMin: 90000,
        }),
        product(ART, {
          externalId: "ext-quote",
          url: "https://example.test/art/quote",
          title: "Quote Piece",
          slug: "quote-piece",
          priceMin: undefined,
        }),
      ],
      "FINISHED_ART",
    );

    // A supplies source: one ₹500 pigment paste. Its price is league
    // context and must never reach a FINISHED_ART benchmark.
    await db.scrapeSource.upsert({
      where: { key: DIY },
      create: {
        key: DIY,
        name: DIY,
        baseUrl: "https://example.test",
        tier: "SUPPLIES",
        analyticsLeague: "MATERIALS_DIY",
      },
      update: { analyticsLeague: "MATERIALS_DIY" },
    });
    const diySource = await db.scrapeSource.findUniqueOrThrow({
      where: { key: DIY },
      select: { id: true },
    });
    const diyJob = await db.scrapeJob.create({
      data: {
        source: { connect: { id: diySource.id } },
        sourceKey: DIY,
        sourceName: DIY,
        vertical: "RESIN",
        platform: "SHOPIFY",
        scope: "SOURCE",
        status: "RUNNING",
        inputUrl: "https://example.test",
      },
      select: { id: true },
    });
    await upsertPageForTest(
      diyJob.id,
      DIY,
      [
        product(DIY, {
          externalId: "ext-pigment",
          url: "https://example.test/diy/pigment",
          title: "Pigment Paste",
          slug: "pigment-paste",
          priceMin: 500,
        }),
      ],
      "MATERIALS_DIY",
    );

    latestJobId = diyJob.id;
  });

  // Leave the shared database as this suite found it (the convention the
  // older suites already follow): league-wide medians in analytics.test.ts
  // read EVERY source, so a suite that leaves priced rows behind moves
  // another suite's numbers on the next run.
  afterAll(async () => {
    if (!db) return;
    await db.researchProduct.deleteMany({ where: { sourceKey: { in: [ART, DIY] } } });
    await db.scrapedProduct.deleteMany({ where: { sourceKey: { in: [ART, DIY] } } });
    await db.scrapeJob.deleteMany({ where: { sourceKey: { in: [ART, DIY] } } });
    await db.scrapeSource.deleteMany({ where: { key: { in: [ART, DIY] } } });
  });

  it("recompute writes every league × scope league-wide, the funnel, and per-source rows — all stamped", async () => {
    const { recomputeAnalytics } = await import(
      "@/lib/scraper/analytics-query"
    );
    const report = await recomputeAnalytics();

    const leagueWide = await db!.analyticsSnapshot.findMany({
      where: { sourceKey: "" },
    });
    const benchmarks = leagueWide.filter(
      (s) => s.view === "league-price-benchmark",
    );
    // Three leagues × four comparison scopes, league-wide, whether or not a
    // league has rows yet — an empty league's benchmark is an honest all-null
    // payload with considered 0, not a missing row.
    expect(benchmarks).toHaveLength(
      3 * COMPARISON_SCOPES.length,
    );
    expect(
      leagueWide.filter((s) => s.view === "funnel-overview"),
    ).toHaveLength(1);

    // Per-source rows exist for exactly the sources that have rows; our two
    // fixtures contribute four scopes each.
    const ours = await db!.analyticsSnapshot.findMany({
      where: { sourceKey: { in: [ART, DIY] } },
    });
    expect(ours).toHaveLength(2 * COMPARISON_SCOPES.length);

    for (const snap of await db!.analyticsSnapshot.findMany()) {
      expect(snap.computedAt.getTime()).toBe(report.computedAt.getTime());
      expect(snap.scrapeRunId).toBe(latestJobId);
      expect(snap.normalizerVersion).toBe(SCRAPER_NORMALIZER_VERSION);
      expect(snap.analyticsVersion).toBe(ANALYTICS_VERSION);
    }
  });

  it("our finished-art benchmark: median ₹60,000, computed from 3 of 4 with the quote-only row named", async () => {
    const row = await db!.analyticsSnapshot.findUniqueOrThrow({
      where: {
        view_league_scope_sourceKey: {
          view: "league-price-benchmark",
          league: "FINISHED_ART",
          scope: "UNIQUE_DESIGN",
          sourceKey: ART,
        },
      },
    });
    const payload = benchmarkPayload(row.payload);
    expect(payload.stats.medianMinor).toBe(60000_00);
    expect(payload.computedFrom.included).toBe(3);
    expect(payload.computedFrom.considered).toBe(4);
    expect(payload.computedFrom.exclusions.quoteOnly).toBe(1);
    // The duplicated columns say the same thing — the table is auditable
    // as SQL, not only as JSON.
    expect(row.includedCount).toBe(3);
    expect(row.consideredCount).toBe(4);
  });

  it("the pigment price never reaches a FINISHED_ART benchmark — the guard holds end to end", async () => {
    const pigmentId = await researchProductId(DIY, "ext-pigment");
    const artIds = await Promise.all(
      ["ext-1", "ext-2", "ext-3"].map((e) => researchProductId(ART, e)),
    );

    const leagueWide = await db!.analyticsSnapshot.findUniqueOrThrow({
      where: {
        view_league_scope_sourceKey: {
          view: "league-price-benchmark",
          league: "FINISHED_ART",
          scope: "UNIQUE_DESIGN",
          sourceKey: "",
        },
      },
    });
    const payload = benchmarkPayload(leagueWide.payload);
    const pickIds = payload.picks.map((p) => p.researchProductId);
    expect(pickIds).not.toContain(pigmentId);
    for (const id of artIds) expect(pickIds).toContain(id);
  });

  it("every stored payload's accounting closes: included + exclusions = considered", async () => {
    const snapshots = await db!.analyticsSnapshot.findMany({
      where: { view: "league-price-benchmark" },
    });
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snap of snapshots) {
      const payload = benchmarkPayload(snap.payload);
      expect(accountingCloses(payload.computedFrom)).toBe(true);
      expect(snap.includedCount).toBe(payload.computedFrom.included);
      expect(snap.consideredCount).toBe(payload.computedFrom.considered);
    }
  });

  it("the quote-only arena is a COUNT with every price stat null", async () => {
    const row = await db!.analyticsSnapshot.findUniqueOrThrow({
      where: {
        view_league_scope_sourceKey: {
          view: "league-price-benchmark",
          league: "FINISHED_ART",
          scope: "QUOTE_ONLY_SEPARATE",
          sourceKey: ART,
        },
      },
    });
    const payload = benchmarkPayload(row.payload);
    expect(payload.computedFrom.included).toBe(1);
    expect(payload.stats.count).toBe(0);
    expect(payload.stats.medianMinor).toBeNull();
    expect(payload.stats.minMinor).toBeNull();
    expect(payload.stats.maxMinor).toBeNull();
  });

  it("the supplies league's own benchmark counts its row as reference: considered 1, included 0", async () => {
    const row = await db!.analyticsSnapshot.findUniqueOrThrow({
      where: {
        view_league_scope_sourceKey: {
          view: "league-price-benchmark",
          league: "MATERIALS_DIY",
          scope: "ALL_VARIANTS",
          sourceKey: DIY,
        },
      },
    });
    const payload = benchmarkPayload(row.payload);
    expect(payload.computedFrom.considered).toBe(1);
    expect(payload.computedFrom.included).toBe(0);
    expect(payload.computedFrom.exclusions.reference).toBe(1);
  });

  it("a shortlisted product is scored as four component rows, with the working attached", async () => {
    const id = await researchProductId(ART, "ext-2"); // the ₹60,000 piece
    const moved = await transitionEntries([id], ShortlistState.SHORTLISTED, {
      changedBy: "user-1",
      reason: "worth benchmarking against",
    });
    expect(moved.moved).toBe(1);

    const { recomputeAnalytics } = await import(
      "@/lib/scraper/analytics-query"
    );
    const report = await recomputeAnalytics();
    // At least ours. Other suites (shortlist-write, embeddings) leave their
    // own shortlisted rows behind on a shared database, so an exact 1 only
    // held on a fresh CI database — the human gate itself is proven by the
    // next test, on this source's un-shortlisted siblings.
    expect(report.productsScored).toBeGreaterThanOrEqual(1);

    const rows = await db!.opportunityScore.findMany({
      where: { researchProductId: id },
    });
    expect(rows).toHaveLength(OPPORTUNITY_COMPONENTS.length);
    expect(rows.map((r) => r.component).sort()).toEqual(
      [...OPPORTUNITY_COMPONENTS].sort(),
    );
    for (const r of rows) {
      expect(r.analyticsVersion).toBe(ANALYTICS_VERSION);
      expect(r.computedAt.getTime()).toBe(report.computedAt.getTime());
    }

    // The piece sits exactly at its league's median: price fit is 1, and
    // the detail shows the working rather than asking for trust.
    const priceFit = rows.find((r) => r.component === "price-fit");
    expect(priceFit?.value).toBeCloseTo(1, 10);
    expect(priceFit?.weight).toBeCloseTo(0.35, 10);
    expect(priceFit?.contribution).toBeCloseTo(0.35, 10);
    expect(priceFit?.detail).toContain("league median ₹60,000");
    expect(priceFit?.detail).toContain("at the median");

    const marketDepth = rows.find((r) => r.component === "market-depth");
    expect(marketDepth?.detail).toContain("3 comparable design(s)");
  });

  it("a product nobody shortlisted is never scored — the score is human-gated derived data", async () => {
    for (const externalId of ["ext-1", "ext-3", "ext-quote"]) {
      const id = await researchProductId(ART, externalId);
      expect(
        await db!.opportunityScore.count({ where: { researchProductId: id } }),
      ).toBe(0);
    }
  });

  it("recompute REPLACES: un-shortlisting prunes the score rows, and the snapshot set does not grow", async () => {
    const id = await researchProductId(ART, "ext-2");
    const moved = await transitionEntries([id], ShortlistState.REJECTED, {
      changedBy: "user-1",
    });
    expect(moved.moved).toBe(1);

    const { recomputeAnalytics } = await import(
      "@/lib/scraper/analytics-query"
    );
    await recomputeAnalytics();

    expect(
      await db!.opportunityScore.count({ where: { researchProductId: id } }),
    ).toBe(0);

    // The derivation was rewritten, not appended to: still exactly the
    // league-wide set plus the funnel at the empty-source key.
    const leagueWide = await db!.analyticsSnapshot.count({
      where: { sourceKey: "" },
    });
    expect(leagueWide).toBe(3 * COMPARISON_SCOPES.length + 1);
  });

  it("the page read assembles stamps, benchmarks, funnel, and ranked opportunities", async () => {
    // Score one product again so the page has an opportunity row to rank.
    // The previous test left it REJECTED, and REJECTED's only exits are
    // NEW and REVIEW (SHORTLIST_TRANSITIONS) — a direct move to SHORTLISTED
    // is refused as a no-op, which is exactly what the machine is for. Two
    // legal moves, then. (The first version of this test made the single
    // illegal move and asserted on a product that was never re-scored.)
    const id = await researchProductId(ART, "ext-2");
    const toReview = await transitionEntries([id], ShortlistState.REVIEW, {
      changedBy: "user-1",
    });
    expect(toReview.moved).toBe(1);
    const toShortlist = await transitionEntries(
      [id],
      ShortlistState.SHORTLISTED,
      { changedBy: "user-1" },
    );
    expect(toShortlist.moved).toBe(1);
    const { recomputeAnalytics, analyticsPageData } = await import(
      "@/lib/scraper/analytics-query"
    );
    const report = await recomputeAnalytics();
    const data = await analyticsPageData();

    expect(data.computedAt?.getTime()).toBe(report.computedAt.getTime());
    expect(data.scrapeRunId).toBe(report.scrapeRunId);
    expect(data.normalizerVersion).toBe(SCRAPER_NORMALIZER_VERSION);
    expect(data.analyticsVersion).toBe(ANALYTICS_VERSION);

    expect(data.leagueBenchmarks.length).toBe(3 * COMPARISON_SCOPES.length);
    expect(data.sourceBenchmarks.length).toBeGreaterThanOrEqual(
      2 * COMPARISON_SCOPES.length,
    );

    expect(data.funnel).not.toBeNull();
    expect(data.funnel!.computedFrom.included).toBe(
      data.funnel!.computedFrom.considered,
    );

    // Ours is on the ranked list; other suites' shortlisted rows may be too.
    const ours = data.opportunities.find((o) => o.researchProductId === id);
    expect(ours).toBeDefined();
    expect(ours!.components).toHaveLength(
      OPPORTUNITY_COMPONENTS.length,
    );
    const expectedTotal = ours!.components.reduce(
      (a, c) => a + c.contribution,
      0,
    );
    expect(ours!.total).toBeCloseTo(expectedTotal, 10);
    expect(data.staleScoresPrunedOnNextRun).toBe(0);
  });
});
