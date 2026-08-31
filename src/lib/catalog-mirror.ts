import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { safeFetch } from "@/lib/scraper/ssrf";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/storage";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Catalog image mirroring (audit C3 / M-A5).
 *
 * ~10k ProductImage rows on published products hot-link scraped source-store
 * hosts (Shopify CDN, banteybanatey, i0.wp.com, …). This module copies them
 * in resumable batches into owned storage — Vercel Blob in production, the
 * local public/uploads fallback in development — and rewrites each row's url
 * on success. Failure semantics follow mirrorProductImage
 * (src/actions/import.ts): ANY failure (dead host, non-image response,
 * oversize file) leaves the row's original URL untouched, so the storefront
 * never loses an image to a mirroring hiccup and the next batch simply
 * retries it.
 *
 * Resumability is free: the WHERE clause only matches rows still pointing at
 * external hosts, so mirrored rows (blob URL, or a root-relative /uploads
 * path that no longer starts with "http") fall out of the selection and a
 * re-run picks up exactly where the last one stopped.
 *
 * Deterministic pathnames — `catalog/<sha1(originalUrl)>.<ext>` — make
 * re-mirroring idempotent (re-uploading the same source URL overwrites the
 * same object instead of accreting copies) and let other code map a source
 * URL to its mirrored file by hashing alone. The `catalog/` prefix is
 * load-bearing: isOptimizableImageSrc (src/lib/image-src.ts) excludes it
 * from next/image optimization so ~10k mirrored files cannot burn the
 * Vercel optimizer quota — the original C3 concern.
 */

/** Hosts we own or deliberately keep external (optimizer-eligible via
 *  next.config.ts remotePatterns) — never mirrored. Substring markers, used
 *  identically by the batch WHERE clause and the studio visibility card. */
export const OWNED_HOST_MARKERS = [
  ".public.blob.vercel-storage.com",
  "res.cloudinary.com",
  "kanhakreation.com",
] as const;

/**
 * ProductImage rows still needing a mirror: on a PUBLISHED product, absolute
 * http(s) URL, not on an owned/optimizer-eligible host. Mirrored rows never
 * match again (blob URLs hit the first marker; local /uploads paths don't
 * start with "http").
 */
export const externalCatalogImageWhere: Prisma.ProductImageWhereInput = {
  product: { status: "PUBLISHED" },
  url: { startsWith: "http" },
  NOT: OWNED_HOST_MARKERS.map((marker) => ({ url: { contains: marker } })),
};

/** Portfolio gallery rows on published pieces still hot-linking external
 *  hosts (md-sweep coverage gap: 64 rows at audit time). */
export const externalPortfolioImageWhere: Prisma.PortfolioImageWhereInput = {
  portfolio: { status: "PUBLISHED" },
  url: { startsWith: "http" },
  NOT: OWNED_HOST_MARKERS.map((marker) => ({ url: { contains: marker } })),
};

/** Category cover images still hot-linking external hosts (11 at audit). */
export const externalCategoryImageWhere: Prisma.CategoryWhereInput = {
  image: { startsWith: "http" },
  NOT: OWNED_HOST_MARKERS.map((marker) => ({ image: { contains: marker } })),
};

const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 6;
/** Matches the media-library / import-mirror cap. */
const MAX_BYTES = 8 * 1024 * 1024;
/** Honest self-identification for the source hosts we fetch from. */
const USER_AGENT =
  "Rivya Living ArtImageMirror/1.0 (+https://store.bhavyagondaliya.co.in; catalog image mirroring)";

/**
 * Shopify's CDN resizes server-side via ?width=. One mirrored 1600px file
 * serves both the card slot and the PDP hero, instead of archiving the
 * multi-MB original. Other hosts are fetched as stored.
 */
function sourceFetchUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl);
    if (url.hostname === "cdn.shopify.com") {
      url.searchParams.set("width", "1600");
      return url.toString();
    }
  } catch {
    // malformed — let the fetch itself fail and count it
  }
  return originalUrl;
}

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Driver-parallel twin of storage.ts's putFile for the mirror pipeline.
 * putFile deliberately uniquifies every pathname (blob addRandomSuffix,
 * local `-<uuid>` suffix) because studio uploads must never collide — but
 * mirroring needs the opposite: an EXACT, deterministic pathname so
 * re-mirroring the same source URL overwrites in place. Same driver split
 * (Vercel Blob when BLOB_READ_WRITE_TOKEN is set, public/uploads otherwise),
 * same public-URL shapes — only the suffix behaviour differs.
 */
async function storeCatalogImage(
  data: Buffer,
  pathname: string,
  contentType: string,
): Promise<string> {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      // @vercel/blob v2 throws on same-pathname re-uploads by default;
      // overwriting is exactly what makes a re-mirror idempotent.
      allowOverwrite: true,
    });
    return blob.url;
  }

  // Local driver: plain write — overwrites an existing file, matching the
  // blob driver's allowOverwrite semantics.
  const target = path.join(LOCAL_ROOT, pathname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return `/uploads/${pathname}`;
}

/** One mirrorable row from any source table, with its own URL-rewrite. */
type MirrorRow = {
  id: string;
  url: string;
  /** Persist the mirrored URL back onto this row's table. */
  save: (id: string, storedUrl: string) => Promise<unknown>;
};

/** Mirror one row. True on success (row url rewritten), false on any failure
 *  (row untouched — original URL keeps serving). */
async function mirrorOne(row: MirrorRow): Promise<boolean> {
  try {
    const response = await safeFetch(sourceFetchUrl(row.url), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "image/*" },
    });
    if (!response.ok) return false;

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      return false;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return false;

    const ext = ACCEPTED_UPLOAD_TYPES[contentType] ?? ".jpg";
    // sha1 of the ORIGINAL stored URL (not the ?width=-augmented fetch URL):
    // the row's url is the stable identity of the source image, and hashing
    // it lets any code re-derive the mirrored pathname later.
    const digest = createHash("sha1").update(row.url).digest("hex");
    const storedUrl = await storeCatalogImage(
      buffer,
      `catalog/${digest}${ext}`,
      contentType,
    );

    await row.save(row.id, storedUrl);
    return true;
  } catch (error) {
    console.error(
      `catalog-mirror: ${row.url} failed:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export type CatalogMirrorCounts = {
  /** Rows selected for this batch. */
  scanned: number;
  /** Rows fetched, stored and rewritten to the mirrored URL. */
  mirrored: number;
  /** Rows left untouched after a fetch/store failure (retried next run). */
  failed: number;
  /** External rows still unmirrored after this batch (includes failures). */
  remaining: number;
};

/**
 * Mirror up to `limit` external catalog images. Small fixed concurrency —
 * polite to the source hosts, fast enough to clear ~10k images in a few
 * nightly cron runs. Writes one "catalog-mirror" ActivityLog row per batch
 * (userId null = system actor) so the studio import center can show the
 * last run.
 */
export async function mirrorCatalogImagesBatch(
  limit: number,
): Promise<CatalogMirrorCounts> {
  // Products first (the ~10k bulk), then the small portfolio/category tails
  // (md-sweep coverage extension) — one shared budget per batch.
  const productRows = await db.productImage.findMany({
    where: externalCatalogImageWhere,
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, url: true },
  });
  const saveProduct = (id: string, url: string) =>
    db.productImage.update({ where: { id }, data: { url } });

  let budget = limit - productRows.length;
  const portfolioRows =
    budget > 0
      ? await db.portfolioImage.findMany({
          where: externalPortfolioImageWhere,
          orderBy: { id: "asc" },
          take: budget,
          select: { id: true, url: true },
        })
      : [];
  const savePortfolio = (id: string, url: string) =>
    db.portfolioImage.update({ where: { id }, data: { url } });

  budget -= portfolioRows.length;
  const categoryRows =
    budget > 0
      ? await db.category.findMany({
          where: externalCategoryImageWhere,
          orderBy: { id: "asc" },
          take: budget,
          select: { id: true, image: true },
        })
      : [];
  const saveCategory = (id: string, image: string) =>
    db.category.update({ where: { id }, data: { image } });

  const rows: MirrorRow[] = [
    ...productRows.map((r) => ({ ...r, save: saveProduct })),
    ...portfolioRows.map((r) => ({ ...r, save: savePortfolio })),
    // The WHERE clause guarantees a non-null image; Prisma's types don't
    // narrow through it, so filter for the compiler.
    ...categoryRows.flatMap((r) =>
      r.image ? [{ id: r.id, url: r.image, save: saveCategory }] : [],
    ),
  ];

  let mirrored = 0;
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= rows.length) return;
        if (await mirrorOne(rows[index])) mirrored++;
        else failed++;
      }
    }),
  );

  const [remainingProducts, remainingPortfolio, remainingCategories] =
    await Promise.all([
      db.productImage.count({ where: externalCatalogImageWhere }),
      db.portfolioImage.count({ where: externalPortfolioImageWhere }),
      db.category.count({ where: externalCategoryImageWhere }),
    ]);
  const remaining =
    remainingProducts + remainingPortfolio + remainingCategories;

  const counts: CatalogMirrorCounts = {
    scanned: rows.length,
    mirrored,
    failed,
    remaining,
  };
  await logActivity({
    userId: null,
    action: "catalog-mirror",
    entity: "product",
    meta: counts,
  });
  return counts;
}
