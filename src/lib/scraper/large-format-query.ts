/**
 * Large-format workspace (A9, plan §6 — "Prompt 22. Image-first, dimensions,
 * material stack, reference board") — server-only read assembly.
 *
 * The workspace answers the owner's working question for the furniture end
 * of the business: what are the large-format pieces we are actively
 * benchmarking against, what do they look like, how big are they, what are
 * they made of — and what else looks like them (B9's neighbours). The
 * reference board is the funnel's own INSPIRATION_ONLY state, surfaced as
 * the image wall it was always meant to be.
 *
 * Two deliberate scope decisions, stated:
 *   1. "Large-format" reads the SOURCE's size tier (`ScrapeTier.
 *      LARGE_FORMAT`), not the league — the tier is the owner's taxonomy for
 *      which supplier list a source came from, and this workspace is about
 *      that business segment.
 *   2. The main grid is human-gated: SHORTLISTED and CONFIRMED pieces only
 *      (rule 8). NEW arrivals wait in the inbox; the workspace is where
 *      decisions already made get worked with.
 */
import { AliasKind, ShortlistState } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolveWithMap, type AliasMap } from "@/lib/scraper/alias-resolver";
import { pickReferenceVariant } from "@/lib/scraper/comparison-scopes";
import type { ScopedVariantRow } from "@/lib/scraper/comparison-scopes";
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "@/lib/scraper/embedding";
import { splitMaterialList } from "@/lib/scraper/explorer";

/** Neighbours shown per card — the workspace skims; the analytics surface
 *  lists the full NEIGHBOUR_LIMIT. */
const CARD_NEIGHBOURS = 3;

export type LargeFormatCard = {
  researchProductId: string;
  title: string;
  url: string;
  sourceName: string;
  state: ShortlistState;
  /** Leading image URL from the staged row, or null — the card renders a
   *  labelled placeholder, never a broken frame. */
  image: string | null;
  imageAlt: string;
  dimensions: string | null;
  /** Alias-resolved material chips. */
  materials: string[];
  referencePriceMinor: number | null;
  variantCount: number;
  /** B9 neighbours, when embeddings have been computed — empty otherwise. */
  neighbours: { researchProductId: string; title: string; similarity: number }[];
};

export type ReferenceBoardTile = {
  researchProductId: string;
  title: string;
  url: string;
  image: string | null;
  imageAlt: string;
  sourceName: string;
};

export type LargeFormatPageData = {
  cards: LargeFormatCard[];
  referenceBoard: ReferenceBoardTile[];
  /** How many large-format-tier products the workspace draws from — the
   *  computed-from line. */
  considered: number;
  embeddingsLive: boolean;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function largeFormatPageData(): Promise<LargeFormatPageData> {
  const tierSources = await db.scrapeSource.findMany({
    where: { tier: "LARGE_FORMAT" },
    select: { key: true, name: true },
  });
  const sourceKeys = tierSources.map((s) => s.key);
  const sourceNameByKey = new Map(tierSources.map((s) => [s.key, s.name]));

  const considered = await db.researchProduct.count({
    where: { sourceKey: { in: sourceKeys } },
  });

  const [entries, inspirations, materialRows] = await Promise.all([
    db.shortlistEntry.findMany({
      where: {
        state: { in: [ShortlistState.SHORTLISTED, ShortlistState.CONFIRMED] },
        researchProduct: { sourceKey: { in: sourceKeys } },
      },
      select: {
        researchProductId: true,
        state: true,
        researchProduct: {
          select: {
            sourceKey: true,
            externalId: true,
            canonicalUrl: true,
          },
        },
      },
      orderBy: { changedAt: "desc" },
    }),
    db.shortlistEntry.findMany({
      where: { state: ShortlistState.INSPIRATION_ONLY },
      select: {
        researchProductId: true,
        researchProduct: {
          select: { sourceKey: true, externalId: true, canonicalUrl: true },
        },
      },
      orderBy: { changedAt: "desc" },
      take: 60,
    }),
    db.normalizationAlias.findMany({
      where: { kind: AliasKind.MATERIAL },
      select: { rawValue: true, canonicalValue: true },
    }),
  ]);

  const materialMap: AliasMap = {};
  for (const row of materialRows) materialMap[row.rawValue] = row.canonicalValue;

  const allRefs = [
    ...entries.map((e) => e.researchProduct),
    ...inspirations.map((e) => e.researchProduct),
  ];
  const twins =
    allRefs.length > 0
      ? await db.scrapedProduct.findMany({
          where: {
            OR: allRefs.map((p) => ({
              sourceKey: p.sourceKey,
              externalId: p.externalId,
            })),
          },
          select: {
            sourceKey: true,
            externalId: true,
            title: true,
            url: true,
            materials: true,
            dimensions: true,
            images: true,
            imageAlts: true,
          },
        })
      : [];
  const twinByPair = new Map(
    twins.map((t) => [`${t.sourceKey} ${t.externalId}`, t]),
  );

  const snapshots =
    entries.length > 0
      ? await db.productSnapshot.findMany({
          where: {
            researchProductId: { in: entries.map((e) => e.researchProductId) },
          },
          orderBy: { capturedAt: "desc" },
          distinct: ["researchProductId"],
          include: { variants: true },
        })
      : [];
  const snapshotByProduct = new Map(
    snapshots.map((s) => [s.researchProductId, s]),
  );

  // B9 neighbours for the grid, when embeddings exist. Same raw-SQL read as
  // the analytics surface — pgvector's operator, never a hand-rolled scan.
  const embeddingCount = await db.productEmbedding.count({
    where: { model: EMBEDDING_MODEL, version: EMBEDDING_VERSION },
  });
  const embeddingsLive = embeddingCount > 0;

  const cards: LargeFormatCard[] = [];
  for (const entry of entries) {
    const product = entry.researchProduct;
    const twin = twinByPair.get(`${product.sourceKey} ${product.externalId}`);
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

    let neighbours: LargeFormatCard["neighbours"] = [];
    if (embeddingsLive) {
      const found = await db.$queryRaw<
        { id: string; similarity: number }[]
      >`
        SELECT
          b."researchProductId" AS id,
          1 - (a.vector <=> b.vector) AS similarity
        FROM "ProductEmbedding" a
        JOIN "ProductEmbedding" b
          ON b.model = a.model AND b.version = a.version
         AND b."researchProductId" <> a."researchProductId"
        WHERE a.model = ${EMBEDDING_MODEL} AND a.version = ${EMBEDDING_VERSION}
          AND a."researchProductId" = ${entry.researchProductId}
        ORDER BY a.vector <=> b.vector ASC
        LIMIT ${CARD_NEIGHBOURS}
      `;
      neighbours = found.map((n) => ({
        researchProductId: n.id,
        title: n.id,
        similarity: n.similarity,
      }));
    }

    const images = twin ? toStringArray(twin.images) : [];
    const alts = twin ? toStringArray(twin.imageAlts) : [];
    cards.push({
      researchProductId: entry.researchProductId,
      title: twin?.title ?? product.canonicalUrl,
      url: twin?.url ?? product.canonicalUrl,
      sourceName: sourceNameByKey.get(product.sourceKey) ?? product.sourceKey,
      state: entry.state,
      image: images[0] ?? null,
      imageAlt: alts[0] ?? twin?.title ?? "",
      dimensions: twin?.dimensions ?? null,
      materials: splitMaterialList(twin?.materials ?? null).map((m) =>
        resolveWithMap(materialMap, AliasKind.MATERIAL, m),
      ),
      referencePriceMinor: pick?.row.priceMinor ?? null,
      variantCount: rows.length,
      neighbours,
    });
  }

  // Neighbour titles need the neighbours' own twins — a second small join,
  // only when embeddings are live and any card found neighbours.
  const neighbourIds = [...new Set(cards.flatMap((c) => c.neighbours.map((n) => n.researchProductId)))];
  if (neighbourIds.length > 0) {
    const neighbourProducts = await db.researchProduct.findMany({
      where: { id: { in: neighbourIds } },
      select: { id: true, sourceKey: true, externalId: true, canonicalUrl: true },
    });
    const neighbourTwins = await db.scrapedProduct.findMany({
      where: {
        OR: neighbourProducts.map((p) => ({
          sourceKey: p.sourceKey,
          externalId: p.externalId,
        })),
      },
      select: { sourceKey: true, externalId: true, title: true },
    });
    const neighbourTwinByPair = new Map(
      neighbourTwins.map((t) => [`${t.sourceKey} ${t.externalId}`, t.title]),
    );
    const titleById = new Map(
      neighbourProducts.map((p) => [
        p.id,
        neighbourTwinByPair.get(`${p.sourceKey} ${p.externalId}`) ?? p.canonicalUrl,
      ]),
    );
    for (const card of cards) {
      card.neighbours = card.neighbours.map((n) => ({
        ...n,
        title: titleById.get(n.researchProductId) ?? n.title,
      }));
    }
  }

  const referenceBoard: ReferenceBoardTile[] = inspirations.map((entry) => {
    const product = entry.researchProduct;
    const twin = twinByPair.get(`${product.sourceKey} ${product.externalId}`);
    const images = twin ? toStringArray(twin.images) : [];
    const alts = twin ? toStringArray(twin.imageAlts) : [];
    return {
      researchProductId: entry.researchProductId,
      title: twin?.title ?? product.canonicalUrl,
      url: twin?.url ?? product.canonicalUrl,
      image: images[0] ?? null,
      imageAlt: alts[0] ?? twin?.title ?? "",
      sourceName: sourceNameByKey.get(product.sourceKey) ?? product.sourceKey,
    };
  });

  return {
    cards,
    referenceBoard,
    considered,
    embeddingsLive,
  };
}
