import "server-only";

import { cache } from "react";
import { draftMode } from "next/headers";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { isCopyKey, type CopyOverrides } from "@/lib/site-copy";

/**
 * Owner overrides for storefront copy, layered over the shipped catalogues by
 * `src/i18n/request.ts`.
 *
 * Cached exactly the way `getSiteImages` is: `cache()` dedupes across the
 * layout and page within one request, and the row read is cached cross-request
 * for 24h with tag invalidation from the studio action.
 *
 * **The TTL is not a preference.** A route's ISR interval is
 * `min(segment revalidate, every cached read it performs)`, and this read
 * happens on every route in the app. A 300s TTL here would silently drop
 * `/product/[slug]` from its declared 86400s across 4,373 products × 9
 * locales — the same failure `catalog-nav.ts:97` records from the last time
 * someone tried it. Freshness comes from `revalidateTag`, never from a short
 * TTL.
 */

export const SITE_COPY_TAG = "site-copy";

const readCopyRows = unstable_cache(
  async (locale: string) =>
    db.siteCopy.findMany({
      where: { locale },
      // Both values in one read. The DRAFT one never reaches a visitor: which
      // of the two is used is decided below, after the cache, by a flag only a
      // staff preview cookie can set.
      select: { key: true, value: true, draftValue: true },
    }),
  ["site-copy"],
  { revalidate: 86400, tags: [SITE_COPY_TAG] },
);

/**
 * Every override for one locale, as `{ "Home.hero.headline": "…" }`.
 *
 * A DB hiccup must degrade to the shipped catalogue, never to a blank page —
 * but it must not do so SILENTLY. Swallowing the error here would mean every
 * string quietly served its default and the storefront looked correct, which
 * is precisely the failure mode that once hid a stale Prisma client for a
 * whole debugging session (see the same comment in site-images-server.ts).
 */
export const getSiteCopy = cache(
  async (locale: string): Promise<CopyOverrides> => {
    // Read here, not passed in — see the note on inPreview in
    // site-images-server.ts. One place to get it right.
    const draft = await inPreview();
    const rows = await readCopyRows(locale).catch((error: unknown) => {
      console.error("Site copy unavailable — falling back to defaults:", error);
      return [];
    });

    const overrides: CopyOverrides = {};
    for (const row of rows) {
      // In preview, a staged edit wins; everywhere else it is invisible.
      const raw = draft ? (row.draftValue ?? row.value) : row.value;
      const value = raw.trim();
      // Ignore rows for keys that no longer exist (a renamed key survives in
      // the table until someone clears it) and rows that were blanked.
      if (value && isCopyKey(row.key)) overrides[row.key] = value;
    }
    return overrides;
  },
);

/**
 * Whether this request is a staff preview. Read here rather than passed in —
 * see the note on the twin in site-images-server.ts.
 */
async function inPreview(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

/**
 * Override counts per locale, for the studio board's coverage indicator.
 *
 * Not cached: the studio is a handful of authenticated requests and must show
 * the effect of a save immediately, not after a tag round-trip.
 */
export async function countCopyOverrides(): Promise<Record<string, number>> {
  const rows = await db.siteCopy.groupBy({
    by: ["locale"],
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.locale, r._count._all]));
}

/**
 * Every override for one locale — the studio board's current state.
 *
 * Returns both halves: the board shows the staged wording when there is one
 * and marks the row as unpublished, so an owner can always tell what a visitor
 * is reading from what they have written but not yet released.
 */
export async function readCopyOverridesForStudio(
  locale: string,
): Promise<Record<string, { value: string; draftValue: string | null }>> {
  const rows = await db.siteCopy.findMany({
    where: { locale },
    select: { key: true, value: true, draftValue: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.key, { value: r.value, draftValue: r.draftValue }]),
  );
}

/**
 * How many staged changes are waiting on one surface, across every language
 * and both content layers.
 *
 * Drives the publish bar's "N changes are not published yet". Counted server
 * side so the bar is right on first paint rather than after a round trip, and
 * counted across ALL locales because an owner who staged a Hindi edit and then
 * switched the board to English must still be told it is waiting.
 */
export async function countPendingForSurface(surface: string): Promise<number> {
  const { COPY_SLOTS } = await import("@/lib/site-copy");
  const { SITE_IMAGE_SLOTS } = await import("@/lib/site-images");

  const copyKeys = COPY_SLOTS.filter((s) => s.group === surface).map(
    (s) => s.key,
  );
  const imageKeys = SITE_IMAGE_SLOTS.filter((s) => s.group === surface).map(
    (s) => s.key,
  );

  const [copyRows, images] = await Promise.all([
    copyKeys.length
      ? db.siteCopy.findMany({
          where: { key: { in: copyKeys }, draftValue: { not: null } },
          select: { value: true, draftValue: true },
        })
      : Promise.resolve([]),
    imageKeys.length
      ? db.siteImage.count({
          where: { key: { in: imageKeys }, draft: { not: Prisma.DbNull } },
        })
      : Promise.resolve(0),
  ]);

  // A draft equal to what is published is not a pending change — it is a reset
  // to what was already there, and counting it would show work that is not.
  const copy = copyRows.filter((r) => r.draftValue !== r.value).length;
  return copy + images;
}

type MessageTree = { [key: string]: string | MessageTree };

function walk(tree: MessageTree | undefined, key: string): string | null {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split(".")) {
    if (!node || typeof node === "string") return null;
    node = node[part];
  }
  return typeof node === "string" ? node : null;
}

/**
 * The words a slot ships with in a locale — what a visitor reads while no
 * override is published — falling back to English when the locale lacks the
 * key (the board hides such rows, but an action must not throw on one).
 * Null only when the key is unknown to the catalogue altogether.
 */
export async function shippedCopy(
  key: string,
  locale: string,
): Promise<string | null> {
  const load = (code: string) =>
    import(`../../messages/${code}.json`)
      .then((m) => (m.default ?? m) as MessageTree)
      .catch(() => undefined);
  const own = walk(await load(locale), key);
  if (own) return own;
  return locale === "en" ? null : walk(await load("en"), key);
}
