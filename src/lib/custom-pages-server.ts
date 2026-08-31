import "server-only";

import { cache } from "react";
import { draftMode } from "next/headers";

import { db } from "@/lib/db";
import {
  isCustomBlockType,
  parseBlockData,
  type CustomBlockType,
} from "@/lib/custom-blocks";
import {
  applyBlockTranslations,
  CUSTOM_PAGE_TRANSLATABLE,
  isLive,
} from "@/lib/custom-pages";
import { localize } from "@/lib/localize";

/**
 * Reading a custom landing page. The rules live in `custom-pages.ts`; this
 * module is the database half.
 */

/**
 * The Prisma `where` for pages a visitor may see.
 *
 * Expressed as a filter rather than a predicate applied after `findMany` so
 * the sitemap and `generateStaticParams` page through the live set without
 * loading the drafts. `publishAt: null` covers a page published with no
 * schedule.
 */
export function liveWhere(now: Date = new Date()) {
  return {
    status: "PUBLISHED" as const,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

export type ResolvedBlock = {
  id: string;
  type: CustomBlockType;
  data: Record<string, unknown>;
};

export type ResolvedCustomPage = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  noindex: boolean;
  status: string;
  publishAt: Date | null;
  updatedAt: Date;
  blocks: ResolvedBlock[];
};

async function inPreview(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

/**
 * One page with its blocks, localized and validated, or null.
 *
 * `cache()` so the route's `generateMetadata` and its body share one query. A
 * page that is not live is returned only behind the staff preview cookie — the
 * same gate the blog and product routes use.
 */
export const getCustomPage = cache(
  async (slug: string, locale: string): Promise<ResolvedCustomPage | null> => {
    const row = await db.customPage
      .findUnique({
        where: { slug },
        include: { blocks: { orderBy: { order: "asc" } } },
      })
      .catch((error: unknown) => {
        console.error("Custom page unavailable:", error);
        return null;
      });
    if (!row) return null;

    if (!isLive(row) && !(await inPreview())) return null;

    const lp = localize(row, locale, CUSTOM_PAGE_TRANSLATABLE);

    return {
      id: row.id,
      slug: row.slug,
      title: lp.title,
      seoTitle: lp.seoTitle,
      seoDescription: lp.seoDescription,
      ogImage: row.ogImage,
      noindex: row.noindex,
      status: row.status,
      publishAt: row.publishAt,
      updatedAt: row.updatedAt,
      // An unknown type is dropped rather than rendered: a block written by a
      // catalogue entry that no longer exists has no renderer, and a page that
      // throws is worse than a page missing one band.
      blocks: row.blocks.flatMap((block) => {
        if (!isCustomBlockType(block.type)) return [];
        const data = parseBlockData<Record<string, unknown>>(
          block.type,
          applyBlockTranslations(block.data, block.translations, locale),
        );
        return [{ id: block.id, type: block.type, data }];
      }),
    };
  },
);

/** Every page with its block count, for the studio list. */
export async function listCustomPagesForStudio() {
  return db.customPage.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      publishAt: true,
      noindex: true,
      updatedAt: true,
      _count: { select: { blocks: true } },
    },
  });
}

/** One page with its blocks, unfiltered, for the studio editor. */
export async function getCustomPageForStudio(id: string) {
  return db.customPage.findUnique({
    where: { id },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
}
