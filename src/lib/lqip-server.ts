import "server-only";

import { blurFor } from "@/lib/lqip";
import { db } from "@/lib/db";

/**
 * Batched LQIP resolution over an arbitrary list of URLs (batch D · media
 * system) — the database-backed half of `lqip.ts`.
 *
 * A resolved site-image slot is not always one of the 25 bundled Part 15
 * masters: the owner can repoint any slot to an upload made through the
 * studio media library, and THAT file's `blurDataUrl` (captured on upload by
 * `finalizeAsset`, `docs/media-v3-manifest.json`'s Media-table twin) lives on
 * its `Media` row, not in the bundled manifest. This merges both sources in
 * one call so a page resolving many slots issues one query rather than one
 * per slot.
 *
 * Bundled URLs never touch the database — `blurFor` answers those for free —
 * so the query only ever asks about the URLs that are NOT one of the 25
 * masters, which in the common case (a fresh environment, nothing repointed
 * yet) is zero rows.
 */
export async function blurForMany(
  urls: string[],
): Promise<Map<string, string | undefined>> {
  const resolved = new Map<string, string | undefined>();
  const unresolved: string[] = [];

  for (const url of urls) {
    const bundled = blurFor(url);
    if (bundled) {
      resolved.set(url, bundled);
    } else if (!resolved.has(url)) {
      unresolved.push(url);
    }
  }

  if (unresolved.length > 0) {
    const rows = await db.media
      .findMany({
        where: { url: { in: unresolved }, blurDataUrl: { not: null } },
        select: { url: true, blurDataUrl: true },
      })
      .catch((error: unknown) => {
        // A DB hiccup here must degrade to "no placeholder", never to a
        // broken page — the caller already treats undefined as "skip the
        // blur-up", which is exactly what a plain <Image> without one does.
        console.error("lqip-server: blur lookup failed:", error);
        return [];
      });
    for (const row of rows) {
      if (row.blurDataUrl) resolved.set(row.url, row.blurDataUrl);
    }
  }

  for (const url of urls) {
    if (!resolved.has(url)) resolved.set(url, undefined);
  }
  return resolved;
}
