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
import { ShortlistState } from "@/lib/scraper/shortlist";
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

export type InboxFilter = {
  /** Undefined = all sources. */
  sourceKey?: string;
  /** Free text over the twin's title/slug and the canonical URL. */
  q?: string;
};

async function sliceWhere(filter: InboxFilter): Promise<Prisma.ResearchProductWhereInput> {
  const where: Prisma.ResearchProductWhereInput = {};
  if (filter.sourceKey) where.sourceKey = filter.sourceKey;
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
  return where;
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

  const stateWhere: Prisma.ResearchProductWhereInput =
    state === "ALL"
      ? {}
      : state === ShortlistState.NEW
        ? {
            OR: [
              { shortlistEntry: { is: { state: ShortlistState.NEW } } },
              { shortlistEntry: { is: null } },
            ],
          }
        : { shortlistEntry: { is: { state } } };

  const where: Prisma.ResearchProductWhereInput = { AND: [base, stateWhere] };

  const [totalMatching, products, sourceList] = await Promise.all([
    db.researchProduct.count({ where }),
    db.researchProduct.findMany({
      where,
      include: { shortlistEntry: true },
      orderBy: { lastSeen: "desc" },
      take: INBOX_PAGE_SIZE,
    }),
    db.scrapeSource.findMany({ select: { key: true, name: true } }),
  ]);
  const sourceNameByKey = new Map(sourceList.map((s) => [s.key, s.name]));

  const twins = await db.scrapedProduct.findMany({
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
    return {
      researchProductId: product.id,
      twinId: twin?.id ?? null,
      twinImported: twin?.reviewStatus === "IMPORTED",
      title: twin?.title ?? product.canonicalUrl,
      slug: twin?.slug ?? "",
      url: twin?.url ?? product.canonicalUrl,
      sourceKey: product.sourceKey,
      sourceName: sourceNameByKey.get(product.sourceKey) ?? product.sourceKey,
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
