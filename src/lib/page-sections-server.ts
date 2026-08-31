import "server-only";

import { cache } from "react";
import { draftMode } from "next/headers";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import {
  PAGE_SECTIONS,
  type ResolvedSection,
  type SectionPageKey,
} from "@/lib/page-sections";

/**
 * One page's sections, in the order they should render.
 *
 * Always total, and the fallback is the registry itself: with no rows the page
 * renders its declared order with everything visible, which is exactly what it
 * did before this table existed. So an empty table, a fresh database and an
 * unreachable one all produce the shipped page rather than a blank one.
 *
 * 24h TTL and a tag, for the reason recorded in `catalog-nav.ts:97`.
 */

export const PAGE_SECTIONS_TAG = "page-sections";

const readSectionRows = unstable_cache(
  async (pageKey: string) =>
    db.pageSection.findMany({
      where: { pageKey },
      select: {
        key: true,
        order: true,
        visible: true,
        draftOrder: true,
        draftVisible: true,
        notes: true,
      },
    }),
  ["page-sections"],
  { revalidate: 86400, tags: [PAGE_SECTIONS_TAG] },
);

async function inPreview(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

export const getPageSections = cache(
  async (pageKey: SectionPageKey): Promise<ResolvedSection[]> => {
    const registry = PAGE_SECTIONS[pageKey];
    const draft = await inPreview();

    const rows = await readSectionRows(pageKey).catch((error: unknown) => {
      console.error(
        "Page sections unavailable — falling back to the shipped order:",
        error,
      );
      return [];
    });

    const byKey = new Map(rows.map((r) => [r.key, r]));

    const resolved = registry.map((def, index) => {
      const row = byKey.get(def.key);
      const order = draft
        ? (row?.draftOrder ?? row?.order ?? index)
        : (row?.order ?? index);
      const visibleRaw = draft
        ? (row?.draftVisible ?? row?.visible ?? true)
        : (row?.visible ?? true);
      return {
        ...def,
        order,
        // A section the page cannot lose stays on whatever a row says. The
        // action refuses to hide one, but a hand-edited row must not be able
        // to take the page's only heading off the page.
        visible: def.hideable ? visibleRaw : true,
        unpublished:
          row?.draftOrder != null || row?.draftVisible != null
            ? row.draftOrder !== row.order || row.draftVisible !== row.visible
            : false,
        notes: row?.notes ?? undefined,
      };
    });

    return resolved.sort((a, b) => a.order - b.order);
  },
);

/** Every row plus its registry definition, for the studio screen. */
export async function readSectionsForStudio(pageKey: SectionPageKey) {
  const rows = await db.pageSection.findMany({ where: { pageKey } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return PAGE_SECTIONS[pageKey]
    .map((def, index) => {
      const row = byKey.get(def.key);
      // The studio shows the STAGED arrangement — that is what Publish will
      // release, and what Preview already shows.
      const order = row?.draftOrder ?? row?.order ?? index;
      const visible = row?.draftVisible ?? row?.visible ?? true;
      return {
        ...def,
        order,
        visible: def.hideable ? visible : true,
        unpublished:
          row != null &&
          ((row.draftOrder != null && row.draftOrder !== row.order) ||
            (row.draftVisible != null && row.draftVisible !== row.visible)),
        notes: row?.notes ?? undefined,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** How many sections on this page are staged but not published. */
export async function countPendingSections(
  pageKey: SectionPageKey,
): Promise<number> {
  const rows = await db.pageSection.findMany({
    where: { pageKey },
    select: {
      order: true,
      visible: true,
      draftOrder: true,
      draftVisible: true,
    },
  });
  return rows.filter(
    (r) =>
      (r.draftOrder != null && r.draftOrder !== r.order) ||
      (r.draftVisible != null && r.draftVisible !== r.visible),
  ).length;
}
