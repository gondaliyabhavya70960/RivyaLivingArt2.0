import "server-only";

import { db } from "@/lib/db";
import type { ContentStatus, Prisma } from "@/generated/prisma/client";
import {
  MEDIA_FOLDERS,
  type MediaFolder,
} from "@/components/studio/media/folders";
import { isCoverImage } from "@/lib/media-covers";
import { isSizeBand, SIZE_BANDS, type SizeBand } from "@/lib/media";
import { findMediaUsageDetails, findUnusedMedia } from "@/lib/media-usages";

/**
 * Query layer for the studio media library (batch D · media system).
 *
 * Everything the old `page.tsx` did inline — a single unfiltered `CAP = 200`
 * slice, client-side type filtering over whatever happened to be on that
 * page — moves here as real server-side filtering, sorting and keyset
 * pagination, so the URL is the single source of truth for what is showing
 * and "page 2" of a 4,000-file library is an actual query, not "load
 * everything and slice it in the browser".
 */

export const MEDIA_TYPES = ["IMAGE", "VIDEO", "DOCUMENT", "MODEL3D"] as const;
export type MediaTypeValue = (typeof MEDIA_TYPES)[number];

export const ORIENTATIONS = ["landscape", "portrait", "square"] as const;
export type OrientationValue = (typeof ORIENTATIONS)[number];

export const SORTS = ["newest", "oldest", "largest", "name"] as const;
export type SortValue = (typeof SORTS)[number];

export const BEHAVIOUR_FILTERS = [
  "missing-alt",
  "unused",
  "ai-generated",
] as const;
export type BehaviourFilter = (typeof BEHAVIOUR_FILTERS)[number];

export type ViewValue = "grid" | "list";

export type MediaFilters = {
  folder: MediaFolder | null;
  q: string;
  filter: BehaviourFilter | null;
  type: MediaTypeValue | null;
  orientation: OrientationValue | null;
  from: string | null;
  to: string | null;
  size: SizeBand | null;
  favourite: boolean;
  demo: boolean;
  sort: SortValue;
  view: ViewValue;
  after: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

function str(params: RawParams, key: string): string | null {
  const value = params[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function oneOf<T extends string>(
  params: RawParams,
  key: string,
  values: readonly T[],
): T | null {
  const value = str(params, key);
  return value && (values as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Loose — a bad `yyyy-mm-dd` becomes `null` rather than a thrown error, so
 *  a hand-edited or stale URL degrades to "no date filter" instead of a
 *  broken page. */
function dateParam(params: RawParams, key: string): string | null {
  const value = str(params, key);
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return value;
}

export function parseFilters(params: RawParams): MediaFilters {
  const rawFolder = str(params, "folder");
  return {
    folder:
      rawFolder && (MEDIA_FOLDERS as readonly string[]).includes(rawFolder)
        ? (rawFolder as MediaFolder)
        : null,
    q: (str(params, "q") ?? "").trim().slice(0, 120),
    filter: oneOf(params, "filter", BEHAVIOUR_FILTERS),
    type: oneOf(params, "type", MEDIA_TYPES),
    orientation: oneOf(params, "orientation", ORIENTATIONS),
    from: dateParam(params, "from"),
    to: dateParam(params, "to"),
    size: (() => {
      const value = str(params, "size");
      return value && isSizeBand(value) ? value : null;
    })(),
    favourite: str(params, "favourite") === "1",
    demo: str(params, "demo") === "1",
    sort: oneOf(params, "sort", SORTS) ?? "newest",
    view: oneOf(params, "view", ["grid", "list"] as const) ?? "grid",
    after: str(params, "after"),
  };
}

const ORDER_BY: Record<SortValue, Prisma.MediaOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  largest: [{ bytes: "desc" }, { id: "desc" }],
  name: [{ pathname: "asc" }, { id: "asc" }],
};

/**
 * Prisma cannot compare two columns of the same row (`width` against
 * `height`) in a `where` clause — there is no `Prisma.fieldRef`-style column
 * comparison for a plain model filter, only for relation joins. Three tiny,
 * fully static (no interpolated input) raw queries answer it instead, the
 * same "compute the id set, then `id: { in }`" shape `findUnusedMedia`
 * already uses in `media-usages.ts` for its own unfilterable-in-SQL case.
 */
async function orientationIds(
  orientation: OrientationValue,
): Promise<string[]> {
  const rows =
    orientation === "landscape"
      ? await db.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Media" WHERE width IS NOT NULL AND height IS NOT NULL AND width > height`
      : orientation === "portrait"
        ? await db.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "Media" WHERE width IS NOT NULL AND height IS NOT NULL AND width < height`
        : await db.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "Media" WHERE width IS NOT NULL AND height IS NOT NULL AND width = height`;
  return rows.map((r) => r.id);
}

async function buildWhere(
  filters: MediaFilters,
  orientationIdSet: string[] | null,
): Promise<Prisma.MediaWhereInput> {
  const sizeBand = filters.size
    ? SIZE_BANDS.find((b) => b.value === filters.size)
    : null;

  return {
    ...(filters.folder ? { folder: filters.folder } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.q
      ? {
          OR: [
            { pathname: { contains: filters.q, mode: "insensitive" as const } },
            {
              originalName: {
                contains: filters.q,
                mode: "insensitive" as const,
              },
            },
            { alt: { contains: filters.q, mode: "insensitive" as const } },
            // The drawer lets an owner write a caption and tag an asset
            // `varmala` or `commission-2026`; without these two clauses that
            // label decorated the tile and retrieved nothing, which makes
            // tagging forty assets busywork. `has` is an exact array match —
            // a tag is a chosen token, not prose to search inside.
            { caption: { contains: filters.q, mode: "insensitive" as const } },
            { tags: { has: filters.q } },
          ],
        }
      : {}),
    // Alt text is a property of a picture. Asking a video or a 3D model for
    // one would put every GLB in the library on a to-do list.
    ...(filters.filter === "missing-alt"
      ? { alt: null, type: "IMAGE" as const }
      : {}),
    ...(filters.filter === "ai-generated" ? { provenance: "AI" as const } : {}),
    ...(orientationIdSet ? { id: { in: orientationIdSet } } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from
              ? { gte: new Date(`${filters.from}T00:00:00.000Z`) }
              : {}),
            ...(filters.to
              ? { lte: new Date(`${filters.to}T23:59:59.999Z`) }
              : {}),
          },
        }
      : {}),
    ...(sizeBand
      ? {
          bytes: {
            gte: sizeBand.min,
            ...(sizeBand.max !== null ? { lt: sizeBand.max } : {}),
          },
        }
      : {}),
    ...(filters.favourite ? { favourite: true } : {}),
    ...(filters.demo ? { isDemo: true } : {}),
  };
}

export type MediaRow = Awaited<ReturnType<typeof db.media.findMany>>[number];

const TAKE = 60;
/** Matches the unused-scan cap the old page used. */
const UNUSED_SCAN_CAP = 200;

export type MediaQueryResult = {
  rows: MediaRow[];
  nextCursor: string | null;
  scan: { scanned: number; exhausted: boolean } | null;
  usageDetails: Map<string, string[]>;
};

export async function queryMedia(
  filters: MediaFilters,
): Promise<MediaQueryResult> {
  const orientationIdSet = filters.orientation
    ? await orientationIds(filters.orientation)
    : null;
  const where = await buildWhere(filters, orientationIdSet);

  let rows: MediaRow[];
  let nextCursor: string | null = null;
  let scan: { scanned: number; exhausted: boolean } | null = null;

  if (filters.filter === "unused") {
    // Computed live from a dozen tables, deliberately, because a stored
    // usage counter goes stale the first time somebody adds a table and
    // forgets — see findUnusedMedia's own header. Its own internal cursor
    // (newest first) is independent of `sort`; the display sort has no
    // effect while this filter is active, which the page says.
    const unused = await findUnusedMedia(where, UNUSED_SCAN_CAP);
    scan = { scanned: unused.scanned, exhausted: unused.exhausted };
    rows = await db.media.findMany({
      where: { id: { in: unused.ids } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  } else {
    rows = await db.media.findMany({
      where,
      orderBy: ORDER_BY[filters.sort],
      ...(filters.after ? { cursor: { id: filters.after }, skip: 1 } : {}),
      take: TAKE + 1,
    });
    if (rows.length > TAKE) {
      nextCursor = rows[TAKE - 1]?.id ?? null;
      rows = rows.slice(0, TAKE);
    }
  }

  const usageDetails = await findMediaUsageDetails(rows.map((r) => r.url));

  return { rows, nextCursor, scan, usageDetails };
}

export async function folderCounts(): Promise<Record<string, number>> {
  const grouped = await db.media.groupBy({
    by: ["folder"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.folder] = g._count._all;
  return counts;
}

export async function typeCounts(): Promise<Record<string, number>> {
  const grouped = await db.media.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.type] = g._count._all;
  return counts;
}

export async function totalCount(): Promise<number> {
  return db.media.count();
}

export type ProductCoverTarget = {
  id: string;
  title: string;
  status: ContentStatus;
  isCover: boolean;
};

/**
 * Which PRODUCTS each of these images belongs to, and whether it is already
 * that product's cover — S7's "Set as product cover".
 *
 * Separate from `findMediaUsageDetails`, which answers a different question.
 * That one labels a URL with the PLACES that reference it ("Product gallery
 * ×3") for the delete guard, across a dozen tables, and the header rule on
 * `media-usages.ts` is that every new media-URL table joins it — a rule that
 * stays legible only while that file answers exactly one question. This one
 * needs product IDS and the gallery's order, which the labels deliberately
 * do not carry.
 *
 * Scoped to the page's own rows: the drawer opens one file at a time, but the
 * grid renders up to a page of them and a per-open round trip would mean a
 * query on every click.
 */
export async function productCoverTargets(
  urls: string[],
): Promise<Map<string, ProductCoverTarget[]>> {
  const out = new Map<string, ProductCoverTarget[]>();
  if (urls.length === 0) return out;

  const rows = await db.productImage.findMany({
    where: { url: { in: urls } },
    select: { url: true, productId: true },
  });
  if (rows.length === 0) return out;

  const productIds = [...new Set(rows.map((row) => row.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      title: true,
      // Carried so the DRAWER can run `describePlaceholderPublishProblem`
      // before it calls. `runAction` reports every throw as "something went
      // wrong", so a refusal checked only in the action tells the owner
      // nothing about what to do — the same reason the sections and
      // navigation boards check their guards client-side first.
      status: true,
      images: { select: { url: true, order: true } },
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  for (const row of rows) {
    const product = byId.get(row.productId);
    if (!product) continue;
    const list = out.get(row.url) ?? [];
    // A URL repeated in one gallery must not produce the product twice.
    if (list.some((entry) => entry.id === product.id)) continue;
    list.push({
      id: product.id,
      title: product.title,
      status: product.status,
      isCover: isCoverImage(
        product.images.map((image, index) => ({
          id: String(index),
          url: image.url,
          order: image.order,
        })),
        row.url,
      ),
    });
    out.set(row.url, list);
  }
  return out;
}
