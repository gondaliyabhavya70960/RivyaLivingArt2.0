/**
 * Analytics read/write assembly (B8) — server-only. The pure computation
 * lives in `analytics.ts` (payloads, computed-from-X-of-N accounting) and
 * `opportunity.ts` (the per-component score); this module fetches the rows
 * those functions need, persists the results, and assembles what the Studio
 * page renders.
 *
 * The league guard is the QUERY's job, exactly as B6 drew the line: rows
 * are fetched through `variantWhereForLeague`, so a MATERIALS_DIY pigment
 * price or a B2B MOQ starting point physically cannot reach a FINISHED_ART
 * benchmark — no UI filter is involved. Non-benchmark leagues still get
 * their OWN benchmark rows (the owner wants to know what pigment costs);
 * what they never do is leak into another league's.
 *
 * Recompute is explicit (a Studio action, not a cron): it replaces every
 * AnalyticsSnapshot row and every OpportunityScore row with the fresh set in
 * one transaction each. These are derivations, not dated records — D24
 * protects what a source said, not what we computed from it — and replacing
 * wholesale is what keeps a re-leagued source from leaving a stale
 * per-source row behind under its old league.
 */
import { AnalyticsLeague, ShortlistState } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  ANALYTICS_VERSION,
  funnelOverviewPayload,
  leaguePriceBenchmarkPayload,
  snapshotKey,
  type FunnelOverviewPayload,
  type LeaguePriceBenchmarkPayload,
  type SnapshotKey,
} from "@/lib/scraper/analytics";
import {
  COMPARISON_SCOPES,
  pickReferenceVariant,
  scopeRows,
  type ScopedVariantRow,
} from "@/lib/scraper/comparison-scopes";
import { BENCHMARK_LEAGUE, variantWhereForLeague } from "@/lib/scraper/leagues";
import { sourceKeysForLeague } from "@/lib/scraper/league-query";
import { SCRAPER_NORMALIZER_VERSION } from "@/lib/scraper/normalize";
import {
  OPPORTUNITY_COMPONENTS,
  opportunityTotal,
  scoreOpportunity,
  type ScoredComponent,
} from "@/lib/scraper/opportunity";
import { inboxCounts } from "@/lib/scraper/shortlist-query";

/** A scoped row that still knows which source it came from, so one league
 *  fetch can fan out into per-source benchmarks without a second query. */
type LeagueRow = ScopedVariantRow & { sourceKey: string };

/**
 * Every variant row a league may contribute, per B6's guard. Reference rows
 * are fetched WITH the rest — they count toward `considered` and appear in
 * the exclusions, which is the B8 proof working as intended: the payload
 * shows what was kept out, not just what went in.
 */
async function leagueRows(league: AnalyticsLeague): Promise<LeagueRow[]> {
  const sourceKeys = await sourceKeysForLeague(league);
  if (sourceKeys.length === 0) return [];
  const variants = await db.productVariant.findMany({
    where: variantWhereForLeague(sourceKeys),
    select: {
      snapshotId: true,
      label: true,
      priceMinor: true,
      priceBasis: true,
      isReference: true,
      snapshot: {
        select: {
          capturedAt: true,
          researchProduct: { select: { id: true, sourceKey: true } },
        },
      },
    },
  });
  return variants.map((v) => ({
    snapshotId: v.snapshotId,
    researchProductId: v.snapshot.researchProduct.id,
    capturedAt: v.snapshot.capturedAt,
    label: v.label,
    priceMinor: v.priceMinor,
    priceBasis: v.priceBasis,
    isReference: v.isReference,
    sourceKey: v.snapshot.researchProduct.sourceKey,
  }));
}

type Stamps = {
  computedAt: Date;
  scrapeRunId: string | null;
  normalizerVersion: string;
  analyticsVersion: number;
};

type SnapshotRow = Stamps &
  SnapshotKey & {
    payload: LeaguePriceBenchmarkPayload | FunnelOverviewPayload;
    includedCount: number;
    consideredCount: number;
  };

function snapshotRow(
  key: SnapshotKey,
  payload: LeaguePriceBenchmarkPayload | FunnelOverviewPayload,
  stamps: Stamps,
): SnapshotRow {
  return {
    ...key,
    ...stamps,
    payload,
    includedCount: payload.computedFrom.included,
    consideredCount: payload.computedFrom.considered,
  };
}

export type RecomputeReport = {
  computedAt: Date;
  /** The newest scrape job at compute time — provenance for the stamps. */
  scrapeRunId: string | null;
  snapshotsWritten: number;
  productsScored: number;
  scoreRowsWritten: number;
};

/**
 * Recompute every analytics snapshot and every opportunity score, and
 * persist the result. The only caller is the Studio action behind
 * `requireStaff` — never a scrape, never a cron: the numbers are read-mostly
 * and the owner decides when a fresh read is worth the compute.
 */
export async function recomputeAnalytics(): Promise<RecomputeReport> {
  const computedAt = new Date();
  const latestJob = await db.scrapeJob.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const stamps: Stamps = {
    computedAt,
    scrapeRunId: latestJob?.id ?? null,
    normalizerVersion: SCRAPER_NORMALIZER_VERSION,
    analyticsVersion: ANALYTICS_VERSION,
  };

  // ——— League price benchmarks: every league × every scope, league-wide
  // and per source. The UNIQUE_DESIGN league-wide stats are kept in hand
  // for the opportunity score's price-fit and market-depth components. ———
  const snapshots: SnapshotRow[] = [];
  const benchmarkByLeague = new Map<
    AnalyticsLeague,
    { medianMinor: number | null; designs: number }
  >();

  for (const league of Object.values(AnalyticsLeague)) {
    const rows = await leagueRows(league);
    for (const scope of COMPARISON_SCOPES) {
      const picks = scopeRows(rows, scope);
      const payload = leaguePriceBenchmarkPayload({ league, scope, rows, picks });
      snapshots.push(
        snapshotRow(snapshotKey({ view: "league-price-benchmark", league, scope }), payload, stamps),
      );
      if (scope === "UNIQUE_DESIGN") {
        benchmarkByLeague.set(league, {
          medianMinor: payload.stats.medianMinor,
          designs: picks.length,
        });
      }
    }
    for (const sourceKey of [...new Set(rows.map((r) => r.sourceKey))].sort()) {
      const sourceRows = rows.filter((r) => r.sourceKey === sourceKey);
      for (const scope of COMPARISON_SCOPES) {
        const payload = leaguePriceBenchmarkPayload({
          league,
          scope,
          sourceKey,
          rows: sourceRows,
          picks: scopeRows(sourceRows, scope),
        });
        snapshots.push(
          snapshotRow(
            snapshotKey({ view: "league-price-benchmark", league, scope, sourceKey }),
            payload,
            stamps,
          ),
        );
      }
    }
  }

  // ——— Funnel overview: the corpus counted through the shortlist states.
  // inboxCounts already folds entry-less products into NEW, so the payload
  // accounts for every researched product exactly once. ———
  const counts = await inboxCounts({});
  snapshots.push(
    snapshotRow(
      snapshotKey({ view: "funnel-overview" }),
      funnelOverviewPayload(counts),
      stamps,
    ),
  );

  await db.$transaction([
    db.analyticsSnapshot.deleteMany({}),
    db.analyticsSnapshot.createMany({
      data: snapshots.map((s) => ({
        ...s,
        payload: s.payload as unknown as Prisma.InputJsonValue,
      })),
    }),
  ]);

  // ——— Opportunity scores: SHORTLISTED and CONFIRMED products only. Those
  // are the states a human marked "worth benchmarking against" (B7), so a
  // score's existence is itself a human-gated fact — rule 8 applies to
  // derived data too. ———
  const entries = await db.shortlistEntry.findMany({
    where: { state: { in: [ShortlistState.SHORTLISTED, ShortlistState.CONFIRMED] } },
    select: {
      researchProductId: true,
      researchProduct: { select: { sourceKey: true, lastSeen: true } },
    },
  });
  const productIds = entries.map((e) => e.researchProductId);

  const [snapshotsLatest, sources] = await Promise.all([
    productIds.length > 0
      ? db.productSnapshot.findMany({
          where: { researchProductId: { in: productIds } },
          orderBy: { capturedAt: "desc" },
          distinct: ["researchProductId"],
          include: { variants: true },
        })
      : Promise.resolve([]),
    db.scrapeSource.findMany({
      select: { key: true, analyticsLeague: true },
    }),
  ]);
  const snapshotByProduct = new Map(
    snapshotsLatest.map((s) => [s.researchProductId, s]),
  );
  const leagueBySource = new Map(sources.map((s) => [s.key, s.analyticsLeague]));

  const scoreRows: Prisma.OpportunityScoreCreateManyInput[] = [];
  for (const entry of entries) {
    const snapshot = snapshotByProduct.get(entry.researchProductId);
    const rows: ScopedVariantRow[] = (snapshot?.variants ?? []).map((v) => ({
      snapshotId: v.snapshotId,
      researchProductId: entry.researchProductId,
      capturedAt: snapshot?.capturedAt ?? new Date(0),
      label: v.label,
      priceMinor: v.priceMinor,
      priceBasis: v.priceBasis,
      isReference: v.isReference,
    }));
    const pick = pickReferenceVariant(rows);
    // A product whose source is gone from the registry keeps the benchmark
    // league as the default — the same default the write path used before B6.
    const league =
      leagueBySource.get(entry.researchProduct.sourceKey) ?? BENCHMARK_LEAGUE;
    const benchmark = benchmarkByLeague.get(league) ?? {
      medianMinor: null,
      designs: 0,
    };

    const components = scoreOpportunity({
      referencePriceMinor: pick?.row.priceMinor ?? null,
      benchmarkMedianMinor: benchmark.medianMinor,
      benchmarkDesigns: benchmark.designs,
      lastSeen: entry.researchProduct.lastSeen,
      comparableVariantCount: scopeRows(rows, "ALL_VARIANTS").length,
      now: computedAt,
    });
    for (const c of components) {
      scoreRows.push({
        researchProductId: entry.researchProductId,
        component: c.component,
        value: c.value,
        weight: c.weight,
        contribution: c.contribution,
        detail: c.detail,
        analyticsVersion: ANALYTICS_VERSION,
        computedAt,
      });
    }
  }

  await db.$transaction([
    db.opportunityScore.deleteMany({}),
    db.opportunityScore.createMany({ data: scoreRows }),
  ]);

  return {
    computedAt,
    scrapeRunId: stamps.scrapeRunId,
    snapshotsWritten: snapshots.length,
    productsScored: productIds.length,
    scoreRowsWritten: scoreRows.length,
  };
}

// ————————————————————— Page assembly —————————————————————

export type BenchmarkView = {
  key: SnapshotKey;
  payload: LeaguePriceBenchmarkPayload;
  computedAt: Date;
};

export type OpportunityRow = {
  researchProductId: string;
  title: string;
  url: string;
  sourceName: string;
  state: ShortlistState;
  components: ScoredComponent[];
  /** Σ contribution — a ranking aid computed at read time, never stored. */
  total: number;
};

export type AnalyticsPageData = {
  /** null when nothing has ever been computed — the page shows the empty
   *  state pointing at the Recompute button. */
  computedAt: Date | null;
  scrapeRunId: string | null;
  normalizerVersion: string | null;
  analyticsVersion: number | null;
  /** League-wide rows (sourceKey ""), one per league × scope. */
  leagueBenchmarks: BenchmarkView[];
  /** Per-source rows, for the owner who wants one supplier's arena. */
  sourceBenchmarks: BenchmarkView[];
  funnel: FunnelOverviewPayload | null;
  opportunities: OpportunityRow[];
  /** Products whose score rows were pruned because they left the funnel —
   *  always zero right after a recompute; shown when a stale set survives. */
  staleScoresPrunedOnNextRun: number;
};

const asBenchmarkPayload = (value: unknown): LeaguePriceBenchmarkPayload =>
  value as LeaguePriceBenchmarkPayload;

/**
 * Everything `/studio/scraper/analytics` renders, in one read. Snapshots are
 * replaced wholesale on recompute, so there is at most one row per key and
 * no "latest" disambiguation to get wrong.
 */
export async function analyticsPageData(): Promise<AnalyticsPageData> {
  const [snapshots, scores, sources] = await Promise.all([
    db.analyticsSnapshot.findMany({ orderBy: { computedAt: "desc" } }),
    db.opportunityScore.findMany({
      include: {
        researchProduct: {
          select: {
            sourceKey: true,
            externalId: true,
            canonicalUrl: true,
            shortlistEntry: { select: { state: true } },
          },
        },
      },
    }),
    db.scrapeSource.findMany({ select: { key: true, name: true } }),
  ]);
  const sourceNameByKey = new Map(sources.map((s) => [s.key, s.name]));

  const leagueBenchmarks: BenchmarkView[] = [];
  const sourceBenchmarks: BenchmarkView[] = [];
  let funnel: FunnelOverviewPayload | null = null;
  let computedAt: Date | null = null;
  let scrapeRunId: string | null = null;
  let normalizerVersion: string | null = null;
  let analyticsVersion: number | null = null;

  for (const snap of snapshots) {
    if (!computedAt || snap.computedAt.getTime() > computedAt.getTime()) {
      computedAt = snap.computedAt;
      scrapeRunId = snap.scrapeRunId;
      normalizerVersion = snap.normalizerVersion;
      analyticsVersion = snap.analyticsVersion;
    }
    if (snap.view === "funnel-overview") {
      funnel = snap.payload as unknown as FunnelOverviewPayload;
      continue;
    }
    const view: BenchmarkView = {
      key: snapshotKey({
        view: "league-price-benchmark",
        league: (snap.league || "") as SnapshotKey["league"],
        scope: (snap.scope || "") as SnapshotKey["scope"],
        sourceKey: snap.sourceKey,
      }),
      payload: asBenchmarkPayload(snap.payload),
      computedAt: snap.computedAt,
    };
    if (snap.sourceKey === "") leagueBenchmarks.push(view);
    else sourceBenchmarks.push(view);
  }

  // Opportunity rows: group the per-component rows by product, join the
  // staged twin for a display title, rank by Σ contribution.
  const byProduct = new Map<string, typeof scores>();
  for (const score of scores) {
    const group = byProduct.get(score.researchProductId);
    if (group) group.push(score);
    else byProduct.set(score.researchProductId, [score]);
  }

  const products = [...byProduct.values()].map((group) => group[0].researchProduct);
  const twins = products.length
    ? await db.scrapedProduct.findMany({
        where: {
          OR: products.map((p) => ({
            sourceKey: p.sourceKey,
            externalId: p.externalId,
          })),
        },
        select: { sourceKey: true, externalId: true, title: true, url: true },
      })
    : [];
  const twinByPair = new Map(
    twins.map((t) => [`${t.sourceKey} ${t.externalId}`, t]),
  );

  const opportunities: OpportunityRow[] = [...byProduct.entries()].map(
    ([researchProductId, group]) => {
      const product = group[0].researchProduct;
      const twin = twinByPair.get(`${product.sourceKey} ${product.externalId}`);
      const components: ScoredComponent[] = group
        .map((s) => ({
          component: s.component as ScoredComponent["component"],
          value: s.value,
          weight: s.weight,
          contribution: s.contribution,
          detail: s.detail,
        }))
        .sort(
          (a, b) =>
            OPPORTUNITY_COMPONENTS.indexOf(a.component) -
            OPPORTUNITY_COMPONENTS.indexOf(b.component),
        );
      return {
        researchProductId,
        title: twin?.title ?? product.canonicalUrl,
        url: twin?.url ?? product.canonicalUrl,
        sourceName:
          sourceNameByKey.get(product.sourceKey) ?? product.sourceKey,
        state: product.shortlistEntry?.state ?? ShortlistState.NEW,
        components,
        total: opportunityTotal(components),
      };
    },
  );
  opportunities.sort((a, b) => b.total - a.total);

  // Scores pointing at products no longer shortlisted/confirmed survive only
  // until the next recompute (which rewrites the whole set). Report them so
  // the page can say the number is stale rather than wrong.
  const staleScoresPrunedOnNextRun = opportunities.filter(
    (o) =>
      o.state !== ShortlistState.SHORTLISTED && o.state !== ShortlistState.CONFIRMED,
  ).length;

  return {
    computedAt,
    scrapeRunId,
    normalizerVersion,
    analyticsVersion,
    leagueBenchmarks,
    sourceBenchmarks,
    funnel,
    opportunities,
    staleScoresPrunedOnNextRun,
  };
}
