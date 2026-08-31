import "server-only";

import { cache } from "react";
import { draftMode } from "next/headers";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import {
  SITE_IMAGE_DEFAULT_REFS,
  SITE_IMAGE_FALLBACKS,
  isSiteImageKey,
  type SiteImageKey,
  type SiteImageMap,
  type SiteImageRefMap,
} from "@/lib/site-images";

/**
 * Resolved site imagery: the bundled defaults from the slot registry with the
 * owner's `SiteImage` overrides layered on top.
 *
 * Always total — every key in the registry resolves to a URL, so a page can
 * never render a hole because a row is missing. That is the whole point of
 * keeping the defaults in the repo rather than seeding them into the table.
 *
 * Cached the same way `getSiteSettings` is: `cache()` dedupes across the
 * layout and page in one request, and the row read is cached cross-request
 * for 24h with tag invalidation from the studio actions. The long TTL matches
 * catalog-nav's reasoning — this is read on nearly every route, and route ISR
 * is min(segment, cached reads), so a short TTL here would cap the PDP's.
 */

export const SITE_IMAGES_TAG = "site-images";

const readSiteImageRows = unstable_cache(
  async () =>
    db.siteImage.findMany({
      select: {
        key: true,
        url: true,
        mobileUrl: true,
        focalX: true,
        focalY: true,
        // Staged changes ride along in the same read; which half is used is
        // decided after the cache, by a flag only a staff cookie can set.
        draft: true,
      },
    }),
  ["site-images"],
  { revalidate: 86400, tags: [SITE_IMAGES_TAG] },
);

/**
 * Every slot as a full ref — url, optional mobile crop, focal point.
 *
 * This is the single cached read; `getSiteImages` narrows it to URLs. Both are
 * `cache()`-wrapped, so a page calling one and the layout calling the other
 * still performs one query per request.
 */
export const getSiteImageRefs = cache(async (): Promise<SiteImageRefMap> => {
  const draft = await inPreview();
  // A DB hiccup must degrade to the bundled set, never to a broken page — but
  // it must not do so SILENTLY. Swallowing the error here once hid a stale
  // Prisma client for an entire debugging session: every slot quietly served
  // its default and the storefront looked correct.
  const rows = await readSiteImageRows().catch((error: unknown) => {
    console.error("Site images unavailable — falling back to defaults:", error);
    return [];
  });

  const resolved: SiteImageRefMap = { ...SITE_IMAGE_DEFAULT_REFS };
  for (const row of rows) {
    const staged = draft ? readStagedImage(row.draft) : null;
    const url = (staged?.url ?? row.url).trim();
    // Ignore rows for slots that no longer exist (a renamed key survives in
    // the table until someone clears it) and rows that were blanked.
    if (!url || !isSiteImageKey(row.key)) continue;
    const mobileSource =
      staged && "mobileUrl" in staged ? staged.mobileUrl : row.mobileUrl;
    resolved[row.key] = {
      url,
      mobileUrl: mobileSource?.trim() || null,
      focalX: clampFocal(staged?.focalX ?? row.focalX),
      focalY: clampFocal(staged?.focalY ?? row.focalY),
    };
  }
  return resolved;
});

/**
 * Whether this request is a staff preview.
 *
 * Read HERE rather than passed down from each page. Nine routes render site
 * images; threading a flag through all of them means one of them eventually
 * misses it, and the failure is silent in the direction that matters — a
 * preview that quietly shows the live site, so an owner publishes something
 * they never actually reviewed.
 *
 * Reading draftMode() keeps routes ISR-cacheable (src/app/api/draft/route.ts);
 * the try/catch covers the contexts with no request store, where the honest
 * answer is "not a preview".
 */
async function inPreview(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

/**
 * A staged slot change, defensively.
 *
 * The column is written only by a validated action, so this guards a
 * hand-edited row rather than a code path — but a malformed blob must degrade
 * to "nothing staged" rather than throw on every route in the app.
 *
 * Exported because the Site Images board has to read the same blob to show
 * the owner what they just staged. One reader, so preview and the editing
 * screen can never disagree about what a staged row means.
 */
export function readStagedImage(value: unknown): {
  url?: string;
  mobileUrl?: string | null;
  focalX?: number;
  focalY?: number;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const out: {
    url?: string;
    mobileUrl?: string | null;
    focalX?: number;
    focalY?: number;
  } = {};
  if (typeof rec.url === "string") out.url = rec.url;
  if (typeof rec.mobileUrl === "string") out.mobileUrl = rec.mobileUrl;
  else if (rec.mobileUrl === null) out.mobileUrl = null;
  if (typeof rec.focalX === "number") out.focalX = rec.focalX;
  if (typeof rec.focalY === "number") out.focalY = rec.focalY;
  return Object.keys(out).length ? out : null;
}

/**
 * Out-of-range focal values would produce an object-position off the frame,
 * which reads as a blank crop rather than a wrong one. The column is written
 * only by a validated action, so this is belt-and-braces against a hand-edited
 * row.
 */
function clampFocal(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export const getSiteImages = cache(async (): Promise<SiteImageMap> => {
  const refs = await getSiteImageRefs();
  const resolved: SiteImageMap = { ...SITE_IMAGE_FALLBACKS };
  for (const key of Object.keys(resolved) as SiteImageKey[]) {
    resolved[key] = refs[key].url;
  }
  return resolved;
});

/**
 * Single-slot convenience for the handful of places that need exactly one
 * image and have no other reason to hold the whole map.
 */
export async function getSiteImage(key: SiteImageKey): Promise<string> {
  return (await getSiteImages())[key];
}
