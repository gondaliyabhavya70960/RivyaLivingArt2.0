/**
 * Product explorer read assembly (A9) — server-only. Filters that are facts
 * about the identity or its entry (source, league, shortlist state) run in
 * the QUERY; filters that are facts about the normalized read (price basis,
 * title text) run over the shaped rows, because the pick and the alias map
 * are compute-time by design (B4). The count line — "showing X of N" — is
 * the explorer's version of computed-from-X-of-N: a filtered list that
 * cannot say out of how many is a list asking to be trusted.
 *
 * The corpus is hundreds of rows by design; the read caps at EXPLORER_CAP
 * newest-seen and says so when it truncates.
 */
import {
  AliasKind,
  AnalyticsLeague,
  ShortlistState,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolveWithMap, type AliasMap } from "@/lib/scraper/alias-resolver";
import type { ScopedVariantRow } from "@/lib/scraper/comparison-scopes";
import {
  matchesBasis,
  matchesQuery,
  shapeExplorerRow,
  splitMaterialList,
  type ExplorerBasisFilter,
  type ExplorerRow,
} from "@/lib/scraper/explorer";
import { sourceKeysForLeague } from "@/lib/scraper/league-query";
import { BENCHMARK_LEAGUE } from "@/lib/scraper/leagues";

export const EXPLORER_CAP = 500;

export type ExplorerFilters = {
  league: string; // AnalyticsLeague value or "ALL"
  source: string; // sourceKey or "ALL"
  state: string; // ShortlistState value or "ALL"
  basis: ExplorerBasisFilter | "ALL";
  q: string;
};

export type ExplorerPageData = {
  rows: ExplorerRow[];
  /** Rows after filtering… */
  shown: number;
  /** …of this many researched products considered (post-cap). */
  considered: number;
  truncated: boolean;
  filters: ExplorerFilters;
  sources: { key: string; name: string }[];
  leagues: string[];
  states: string[];
};

export async function explorerPageData(
  filters: ExplorerFilters,
): Promise<ExplorerPageData> {
  // League and source are query-enforced: a league narrows to its source
  // keys via B6's registry read, never to a UI-side filter anyone can clear.
  const leagueSourceKeys =
    filters.league === "ALL"
      ? null
      : await sourceKeysForLeague(filters.league as AnalyticsLeague);

  const where = {
    ...(filters.source !== "ALL" ? { sourceKey: filters.source } : {}),
    ...(leagueSourceKeys ? { sourceKey: { in: leagueSourceKeys } } : {}),
    ...(filters.state === "ALL"
      ? {}
      : filters.state === ShortlistState.NEW
        ? {
            OR: [
              { shortlistEntry: { is: { state: ShortlistState.NEW } } },
              { shortlistEntry: { is: null } },
            ],
          }
        : { shortlistEntry: { is: { state: filters.state as ShortlistState } } }),
  };

  const [products, sources, materialRows] = await Promise.all([
    db.researchProduct.findMany({
      where,
      orderBy: { lastSeen: "desc" },
      take: EXPLORER_CAP,
      include: { shortlistEntry: { select: { state: true } } },
    }),
    db.scrapeSource.findMany({
      select: { key: true, name: true, analyticsLeague: true },
      orderBy: { key: "asc" },
    }),
    db.normalizationAlias.findMany({
      where: { kind: AliasKind.MATERIAL },
      select: { rawValue: true, canonicalValue: true },
    }),
  ]);

  const [twins, snapshots] = await Promise.all([
    products.length > 0
      ? db.scrapedProduct.findMany({
          where: {
            OR: products.map((p) => ({
              sourceKey: p.sourceKey,
              externalId: p.externalId,
            })),
          },
          select: {
            sourceKey: true,
            externalId: true,
            title: true,
            url: true,
            priceMin: true,
            priceMax: true,
            materials: true,
            dimensions: true,
          },
        })
      : Promise.resolve([]),
    products.length > 0
      ? db.productSnapshot.findMany({
          where: { researchProductId: { in: products.map((p) => p.id) } },
          orderBy: { capturedAt: "desc" },
          distinct: ["researchProductId"],
          include: { variants: true },
        })
      : Promise.resolve([]),
  ]);

  const materialMap: AliasMap = {};
  for (const row of materialRows) materialMap[row.rawValue] = row.canonicalValue;
  const sourceByKey = new Map(sources.map((s) => [s.key, s]));
  const twinByPair = new Map(
    twins.map((t) => [`${t.sourceKey} ${t.externalId}`, t]),
  );
  const snapshotByProduct = new Map(
    snapshots.map((s) => [s.researchProductId, s]),
  );

  const resolveMaterials = (raw: string | null): string[] =>
    splitMaterialList(raw).map((m) =>
      resolveWithMap(materialMap, AliasKind.MATERIAL, m),
    );

  const shaped: ExplorerRow[] = products.map((product) => {
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
    const twin = twinByPair.get(`${product.sourceKey} ${product.externalId}`);
    return shapeExplorerRow({
      researchProductId: product.id,
      sourceKey: product.sourceKey,
      sourceName: sourceByKey.get(product.sourceKey)?.name ?? product.sourceKey,
      league:
        sourceByKey.get(product.sourceKey)?.analyticsLeague ?? BENCHMARK_LEAGUE,
      state: product.shortlistEntry?.state ?? ShortlistState.NEW,
      canonicalUrl: product.canonicalUrl,
      lastSeen: product.lastSeen,
      twin: twin ?? null,
      rows,
      resolveMaterials,
    });
  });

  const filtered = shaped.filter(
    (row) => matchesBasis(row, filters.basis) && matchesQuery(row, filters.q),
  );

  return {
    rows: filtered,
    shown: filtered.length,
    considered: products.length,
    truncated: products.length === EXPLORER_CAP,
    filters,
    sources: sources.map((s) => ({ key: s.key, name: s.name })),
    leagues: Object.values(AnalyticsLeague),
    states: Object.values(ShortlistState),
  };
}
