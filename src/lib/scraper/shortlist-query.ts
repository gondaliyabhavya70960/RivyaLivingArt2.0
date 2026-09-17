/**
 * Shortlist read assembly (B7) — server-only. The inbox and the confirmed
 * list both hang off `ResearchProduct` (the identity a decision is ABOUT),
 * with three joins Prisma cannot express as one query because
 * `ResearchProduct.sourceKey` is a plain string, not a relation:
 *
 *   1. `ShortlistEntry`   — the funnel state (absent means NEW)
 *   2. `ScrapedProduct`   — the staged twin, matched on (sourceKey,
 *      externalId), carrying the display fields (title, prices, images)
 *   3. latest `ProductSnapshot` — for the confirmed list's reference price,
 *      picked by B6's `pickReferenceVariant` with its rationale recorded
 *
 * Every row the UI shows carries the entry's provenance (who moved it, when,
 * why) next to the source's data — facts and decisions stay distinguishable.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { ScrapeTier } from "@/generated/prisma/enums";
import { ShortlistState } from "@/lib/scraper/shortlist";
import type { ProductSizeTier } from "@/lib/product-size-tier";
import { matchCategoryId, type CatalogCategory } from "@/lib/scraper/category-map";
import {
  productTypeFromFields,
  suggestSizeTier,
} from "@/lib/scraper/size-tier-suggest";
import { pickReferenceVariant, type ScopedPick, type ScopedVariantRow } from "@/lib/scraper/comparison-scopes";
import type { ConfirmedExportRow } from "@/lib/scraper/confirmed-export";
import { db } from "@/lib/db";

/** Hard cap per inbox view — the truncation note points at the filters. */
export const INBOX_PAGE_SIZE = 200;

/** Cap on title/slug matches folded into a search, so the OR stays sane. */
const SEARCH_MATCH_CAP = 200;

const pairKey = (sourceKey: string, externalId: string) =>
  `${sourceKey}${externalId}`;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

// ————————————————————— Review inbox —————————————————————

/** One row of the rebuilt review inbox — identity + decision + display. */
export type InboxRow = {
  researchProductId: string;
  /** The staged twin's id, when one exists — edit-before-import and the
   *  import dialog still work on ScrapedProduct rows. */
  twinId: string | null;
  /** The twin is already promoted to the catalog — edit-before-import locks. */
  twinImported: boolean;
  title: string;
  slug: string;
  url: string;
  sourceKey: string;
  sourceName: string;
  /** Which supplier list the SOURCE is filed in; null when the source row is
   *  gone. Never the product's tier — see `suggestedSizeTier`. */
  sourceTier: ScrapeTier | null;
  vertical: string;
  category: string | null;
  shortTagline: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  timeline: string | null;
  materials: string | null;
  dimensions: string | null;
  images: string[];
  imageAlts: string[];
  /** Step 6's read-time suggestion from the twin's own words (never stored);
   *  null when nothing scored or the top two tied. */
  suggestedSizeTier: ProductSizeTier | null;
  state: ShortlistState;
  note: string | null;
  tags: string[];
  reason: string | null;
  changedBy: string | null;
  changedAt: Date | null;
  updated: boolean;
  firstSeen: Date;
  lastSeen: Date;
};

export type InboxCounts = Record<ShortlistState, number>;

/** A suggested size tier, or "NONE" for the rows the classifier could not place. */
export type InboxSizeTierFilter = ProductSizeTier | "NONE";

/** The values `InboxSizeTierFilter` admits, for a parser or a select. */
export const INBOX_SIZE_TIER_FILTERS = [
  "LARGE_FORMAT",
  "MEDIUM_FORMAT",
  "SMALL_FORMAT",
  "NONE",
] as const satisfies readonly InboxSizeTierFilter[];

export type InboxFilter = {
  /** Undefined = all sources. */
  sourceKey?: string;
  /**
   * Undefined = every list. This is the SOURCE's tier — which supplier list
   * we went looking in — and `sizeTier` below is the PRODUCT's. They are two
   * filters because a large-format studio sells coasters too.
   */
  sourceTier?: ScrapeTier;
  /**
   * The tier step 6 SUGGESTS for the product from its own title, type,
   * description and dimensions (`suggestSizeTier`), computed at read time
   * and never stored on the row. "NONE" = no suggestion.
   */
  sizeTier?: InboxSizeTierFilter;
  /** Free text over the twin's title/slug and the canonical URL. */
  q?: string;
};

/** The twin columns the classifier reads — one select shared by every path that suggests. */
const SUGGESTION_SELECT = {
  sourceKey: true,
  externalId: true,
  title: true,
  category: true,
  description: true,
  dimensions: true,
  fields: true,
} as const;

type SuggestionTwin = {
  title: string;
  category: string | null;
  description: string | null;
  dimensions: string | null;
  fields: unknown;
};

/**
 * Step 6's suggestion for a staged twin — the same call the source page
 * makes per row — or null with no twin at all. The source's tier is not an
 * input, deliberately.
 */
export function suggestedTierOf(
  twin: SuggestionTwin | null | undefined,
): ProductSizeTier | null {
  if (!twin) return null;
  return suggestSizeTier({
    title: twin.title,
    category: twin.category,
    productType: productTypeFromFields(twin.fields),
    description: twin.description,
    dimensions: twin.dimensions,
  });
}

/**
 * Most products a size-tier filter will scan. The suggestion is computed,
 * not stored, so filtering by it means reading every twin in the slice; the
 * cap keeps one Studio page from loading the whole table. Nine sources at
 * the rollout's 500-product ceiling are 4,500 rows.
 */
const TIER_SCAN_CAP = 10_000;

/** The research products in `base` whose suggested tier is `wanted`. */
async function tierMatchIds(
  base: Prisma.ResearchProductWhereInput,
  wanted: InboxSizeTierFilter,
): Promise<string[]> {
  const products = await db.researchProduct.findMany({
    where: base,
    select: { id: true, sourceKey: true, externalId: true },
    orderBy: { lastSeen: "desc" },
    take: TIER_SCAN_CAP,
  });
  if (products.length === 0) return [];
  // A superset by key and id, matched exactly by pair in memory — an OR of
  // thousands of pairs is the one shape Postgres plans badly.
  const twins = await db.scrapedProduct.findMany({
    where: {
      sourceKey: { in: [...new Set(products.map((p) => p.sourceKey))] },
      externalId: { in: [...new Set(products.map((p) => p.externalId))] },
    },
    select: SUGGESTION_SELECT,
  });
  const twinByPair = new Map(
    twins.map((t) => [pairKey(t.sourceKey, t.externalId), t]),
  );
  const target = wanted === "NONE" ? null : wanted;
  return products
    .filter(
      (p) =>
        suggestedTierOf(twinByPair.get(pairKey(p.sourceKey, p.externalId))) ===
        target,
    )
    .map((p) => p.id);
}

async function sliceWhere(filter: InboxFilter): Promise<Prisma.ResearchProductWhereInput> {
  const where: Prisma.ResearchProductWhereInput = {};
  if (filter.sourceTier) {
    const keys = (
      await db.scrapeSource.findMany({
        where: { tier: filter.sourceTier },
        select: { key: true },
      })
    ).map((s) => s.key);
    // A source picked outside the chosen tier matches nothing: the two
    // filters agree or the slice is empty, never silently one of them.
    where.sourceKey = filter.sourceKey
      ? { in: keys.includes(filter.sourceKey) ? [filter.sourceKey] : [] }
      : { in: keys };
  } else if (filter.sourceKey) {
    where.sourceKey = filter.sourceKey;
  }
  const q = filter.q?.trim();
  if (q) {
    const twins = await db.scrapedProduct.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { sourceKey: true, externalId: true },
      take: SEARCH_MATCH_CAP,
    });
    where.OR = [
      { canonicalUrl: { contains: q, mode: "insensitive" } },
      ...twins.map((t) => ({
        sourceKey: t.sourceKey,
        externalId: t.externalId,
      })),
    ];
  }
  if (!filter.sizeTier) return where;
  return {
    AND: [where, { id: { in: await tierMatchIds(where, filter.sizeTier) } }],
  };
}

/** `state: "NEW"` matches entry-less products too; any other state exactly. */
function stateWhere(
  state: ShortlistState | "ALL",
): Prisma.ResearchProductWhereInput {
  if (state === "ALL") return {};
  if (state === ShortlistState.NEW) {
    return {
      OR: [
        { shortlistEntry: { is: { state: ShortlistState.NEW } } },
        { shortlistEntry: { is: null } },
      ],
    };
  }
  return { shortlistEntry: { is: { state } } };
}

/**
 * Per-state counts over the filtered slice. NEW folds in the entry-less
 * products — "no row" and "row at NEW" are the same state, so the chip must
 * count both or it would lie by omission.
 */
export async function inboxCounts(filter: InboxFilter): Promise<InboxCounts> {
  const base = await sliceWhere(filter);
  const [total, groups, newEntries] = await Promise.all([
    db.researchProduct.count({ where: base }),
    db.shortlistEntry.groupBy({
      by: ["state"],
      where: { researchProduct: base },
      _count: { _all: true },
    }),
    db.shortlistEntry.count({
      where: { researchProduct: base, state: ShortlistState.NEW },
    }),
  ]);
  const counts: InboxCounts = {
    NEW: 0,
    REVIEW: 0,
    SHORTLISTED: 0,
    REJECTED: 0,
    CONFIRMED: 0,
    INSPIRATION_ONLY: 0,
    DUPLICATE: 0,
  };
  let withEntry = 0;
  for (const group of groups) {
    counts[group.state] = group._count._all;
    withEntry += group._count._all;
  }
  counts.NEW = newEntries + (total - withEntry);
  return counts;
}

/**
 * One page of the inbox. `state: "NEW"` matches entry-less products too;
 * any other state matches exactly. Rows are newest-seen first.
 */
export async function inboxRows(
  filter: InboxFilter,
  state: ShortlistState | "ALL",
): Promise<{ rows: InboxRow[]; truncated: boolean; totalMatching: number }> {
  const base = await sliceWhere(filter);
  const where: Prisma.ResearchProductWhereInput = {
    AND: [base, stateWhere(state)],
  };

  const [totalMatching, products, sourceList] = await Promise.all([
    db.researchProduct.count({ where }),
    db.researchProduct.findMany({
      where,
      include: { shortlistEntry: true },
      orderBy: { lastSeen: "desc" },
      take: INBOX_PAGE_SIZE,
    }),
    db.scrapeSource.findMany({ select: { key: true, name: true, tier: true } }),
  ]);
  const sourceByKey = new Map(sourceList.map((s) => [s.key, s]));

  const twins =
    products.length === 0
      ? []
      : await db.scrapedProduct.findMany({
          where: {
            OR: products.map((p) => ({
              sourceKey: p.sourceKey,
              externalId: p.externalId,
            })),
          },
        });
  const twinByPair = new Map(
    twins.map((t) => [pairKey(t.sourceKey, t.externalId), t]),
  );

  const rows: InboxRow[] = products.map((product) => {
    const twin = twinByPair.get(pairKey(product.sourceKey, product.externalId));
    const entry = product.shortlistEntry;
    const source = sourceByKey.get(product.sourceKey);
    return {
      researchProductId: product.id,
      twinId: twin?.id ?? null,
      twinImported: twin?.reviewStatus === "IMPORTED",
      title: twin?.title ?? product.canonicalUrl,
      slug: twin?.slug ?? "",
      url: twin?.url ?? product.canonicalUrl,
      sourceKey: product.sourceKey,
      sourceName: source?.name ?? product.sourceKey,
      sourceTier: source?.tier ?? null,
      vertical: twin?.vertical ?? "resin",
      category: twin?.category ?? null,
      shortTagline: twin?.shortTagline ?? null,
      description: twin?.description ?? null,
      priceMin: twin?.priceMin ?? null,
      priceMax: twin?.priceMax ?? null,
      timeline: twin?.timeline ?? null,
      materials: twin?.materials ?? null,
      dimensions: twin?.dimensions ?? null,
      images: twin ? toStringArray(twin.images) : [],
      imageAlts: twin ? toStringArray(twin.imageAlts) : [],
      suggestedSizeTier: suggestedTierOf(twin),
      state: entry?.state ?? ShortlistState.NEW,
      note: entry?.note ?? twin?.notes ?? null,
      tags: entry?.tags ?? [],
      reason: entry?.reason ?? null,
      changedBy: entry?.changedBy ?? null,
      changedAt: entry?.changedAt ?? null,
      updated: product.lastSeen.getTime() > product.firstSeen.getTime(),
      firstSeen: product.firstSeen,
      lastSeen: product.lastSeen,
    };
  });

  return {
    rows,
    truncated: totalMatching > rows.length,
    totalMatching,
  };
}

// ————————————————————— Selection resolution —————————————————————

/** One importable row of a resolved selection, with the decisions a bulk import needs. */
export type InboxSelectionRow = {
  researchProductId: string;
  twinId: string;
  title: string;
  /** The nearest catalog category by the same auto-map the source page uses, or null. */
  categoryId: string | null;
  suggestedSizeTier: ProductSizeTier | null;
};

export type InboxSelection = {
  /** Every resolved research product — what a funnel move acts on. */
  ids: string[];
  /** The subset with a staged twin not yet in the catalogue. */
  importable: InboxSelectionRow[];
  /** Twins already promoted — nothing to do, and never counted as skipped. */
  alreadyImported: number;
  /** Identities with no staged twin — seen, never staged, nothing to import. */
  noTwin: number;
  /** How many rows the filter matches in all, before the cap. */
  totalMatching: number;
  /** `totalMatching` exceeded SELECTION_CAP: only the first cap rows resolved. */
  capped: boolean;
};

/**
 * Most rows one "select all" resolves. Beyond it the client is told, and a
 * second pass after the first lands picks up the rest — every imported row
 * leaves the importable set, so the loop converges.
 */
export const SELECTION_CAP = 3000;

/**
 * What a filter (or an explicit selection) covers, BEFORE anything moves.
 * Newest-seen first, like the inbox. The categories are passed in so the
 * resolver never depends on what is seeded — a test can hand it its own.
 */
export async function inboxSelection(
  filter: InboxFilter,
  state: ShortlistState | "ALL",
  opts: { ids?: string[]; categories: CatalogCategory[] },
): Promise<InboxSelection> {
  const where: Prisma.ResearchProductWhereInput = opts.ids
    ? { id: { in: opts.ids } }
    : { AND: [await sliceWhere(filter), stateWhere(state)] };

  const [totalMatching, products] = await Promise.all([
    db.researchProduct.count({ where }),
    db.researchProduct.findMany({
      where,
      select: { id: true, sourceKey: true, externalId: true },
      orderBy: { lastSeen: "desc" },
      take: SELECTION_CAP,
    }),
  ]);

  const twins =
    products.length === 0
      ? []
      : await db.scrapedProduct.findMany({
          where: {
            sourceKey: { in: [...new Set(products.map((p) => p.sourceKey))] },
            externalId: {
              in: [...new Set(products.map((p) => p.externalId))],
            },
          },
          select: { ...SUGGESTION_SELECT, id: true, reviewStatus: true },
        });
  const twinByPair = new Map(
    twins.map((t) => [pairKey(t.sourceKey, t.externalId), t]),
  );

  const importable: InboxSelectionRow[] = [];
  let alreadyImported = 0;
  let noTwin = 0;
  for (const product of products) {
    const twin = twinByPair.get(pairKey(product.sourceKey, product.externalId));
    if (!twin) {
      noTwin += 1;
      continue;
    }
    if (twin.reviewStatus === "IMPORTED") {
      alreadyImported += 1;
      continue;
    }
    importable.push({
      researchProductId: product.id,
      twinId: twin.id,
      title: twin.title,
      categoryId: matchCategoryId(twin.category, twin.title, opts.categories),
      suggestedSizeTier: suggestedTierOf(twin),
    });
  }

  return {
    ids: products.map((p) => p.id),
    importable,
    alreadyImported,
    noTwin,
    totalMatching,
    capped: totalMatching > products.length,
  };
}

// ————————————————————— Confirmed list —————————————————————

/** A confirmed product, assembled for the screen AND the export. */
export type ConfirmedRow = ConfirmedExportRow & {
  researchProductId: string;
  /** Leading image for the screen; the export does not carry it. */
  image: string | null;
};

/**
 * The gated final list: every CONFIRMED entry, newest confirmation first,
 * with the reference-variant pick over the latest snapshot. The pick is
 * B6's deterministic chooser, and its rationale rides along — a price with
 * no explanation is exactly what rule 7 forbids shipping.
 */
export async function confirmedRows(): Promise<ConfirmedRow[]> {
  const entries = await db.shortlistEntry.findMany({
    where: { state: ShortlistState.CONFIRMED },
    include: { researchProduct: true },
    orderBy: { changedAt: "desc" },
  });
  if (entries.length === 0) return [];

  const productIds = entries.map((e) => e.researchProductId);
  const [twins, snapshots, sourceList, users] = await Promise.all([
    db.scrapedProduct.findMany({
      where: {
        OR: entries.map((e) => ({
          sourceKey: e.researchProduct.sourceKey,
          externalId: e.researchProduct.externalId,
        })),
      },
    }),
    // Latest snapshot per product — distinct keeps one row each, ordered by
    // recency, with the variants the reference pick reads.
    db.productSnapshot.findMany({
      where: { researchProductId: { in: productIds } },
      orderBy: { capturedAt: "desc" },
      distinct: ["researchProductId"],
      include: { variants: true },
    }),
    db.scrapeSource.findMany({ select: { key: true, name: true } }),
    db.user.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              entries
                .map((e) => e.changedBy)
                .filter((id): id is string => id !== null),
            ),
          ],
        },
      },
      select: { id: true, email: true },
    }),
  ]);

  const twinByPair = new Map(
    twins.map((t) => [pairKey(t.sourceKey, t.externalId), t]),
  );
  const snapshotByProduct = new Map(
    snapshots.map((s) => [s.researchProductId, s]),
  );
  const sourceNameByKey = new Map(sourceList.map((s) => [s.key, s.name]));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return entries.map((entry) => {
    const product = entry.researchProduct;
    const twin = twinByPair.get(pairKey(product.sourceKey, product.externalId));
    const snapshot = snapshotByProduct.get(product.id);

    const scoped: ScopedVariantRow[] = (snapshot?.variants ?? []).map((v) => ({
      snapshotId: v.snapshotId,
      researchProductId: product.id,
      capturedAt: snapshot?.capturedAt ?? new Date(0),
      label: v.label,
      priceMinor: v.priceMinor,
      priceBasis: v.priceBasis,
      isReference: v.isReference,
    }));
    const pick: ScopedPick | null = pickReferenceVariant(scoped);

    return {
      researchProductId: product.id,
      sourceKey: product.sourceKey,
      sourceName: sourceNameByKey.get(product.sourceKey) ?? product.sourceKey,
      externalId: product.externalId,
      title: twin?.title ?? product.canonicalUrl,
      url: twin?.url ?? product.canonicalUrl,
      pick,
      currency: twin?.currency ?? "INR",
      note: entry.note,
      tags: entry.tags,
      confirmedBy: entry.changedBy ? (emailById.get(entry.changedBy) ?? "") : "",
      confirmedAt: entry.changedAt,
      firstSeen: product.firstSeen,
      lastSeen: product.lastSeen,
      image: twin ? (toStringArray(twin.images)[0] ?? null) : null,
    };
  });
}
