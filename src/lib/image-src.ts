/**
 * Whether `next/image`'s built-in optimizer may process this src.
 *
 * Must mirror `images.remotePatterns` in next.config.ts — the optimizer
 * throws at render for any remote host outside that allowlist. That matters
 * because bulk-imported products can legitimately carry a source-store URL
 * when an image mirror fails (mirrorProductImage keeps the original URL by
 * design), and such a URL must degrade to an unoptimized <img>, not crash
 * the page.
 *
 * Rules, matching existing behaviour everywhere else:
 *  - `/uploads/**` — served as-is by our own route: unoptimized;
 *  - other root-relative paths (files in /public): optimizable;
 *  - Cloudinary + Vercel Blob (the remotePatterns allowlist): optimizable —
 *    EXCEPT blob files under `catalog/`: those are the C3-mirrored catalog
 *    images (src/lib/catalog-mirror.ts), pre-sized at ~1600px on exact,
 *    suffix-free pathnames. ~10k of them through next/image would burn the
 *    Vercel optimization quota — the very thing C3 set out to avoid — so
 *    they render as raw <img>, exactly like the external originals they
 *    replaced. Studio-uploaded blob files (products/, media folders, …)
 *    stay optimizable;
 *  - any other remote host, or non-http(s) scheme (data:, blob:): unoptimized.
 */
export function isOptimizableImageSrc(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("/uploads");
  if (!/^https?:\/\//i.test(src)) return false;
  try {
    const url = new URL(src);
    const host = url.hostname;
    if (host.endsWith(".public.blob.vercel-storage.com")) {
      return !url.pathname.startsWith("/catalog/");
    }
    return host === "res.cloudinary.com" || host === "kanhakreation.com";
  } catch {
    return false;
  }
}

/**
 * Whether a stored image URL is one we can actually render — a root-relative
 * path (`/uploads/…` served by our own route, or any `/public` file such as
 * the Step-4 `/images/…` covers), or an absolute http(s) URL. Everything else
 * (empty, data:, blob:, relative junk) is dropped so a broken row never crashes
 * next/image. Single source for the guard that was copy-pasted across 9 files
 * (ENG-810); pairs with isOptimizableImageSrc above, which already treated
 * root-relative /public paths as optimizable — this guard now agrees with it.
 */
export function isRenderableSrc(url: string | null | undefined): url is string {
  return !!url && (url.startsWith("/") || url.startsWith("http"));
}

/**
 * Best-effort size hint for catalog imagery that renders as a raw unoptimized
 * <img> (audit C3 stopgap): ~31k of the imported images live on Shopify's CDN,
 * which resizes server-side via ?width= — capping what ships to the card slot
 * without touching the optimizer quota. Non-Shopify hosts pass through.
 */
export function sizedExternalSrc(src: string, width: number): string {
  try {
    const url = new URL(src);
    if (url.hostname === "cdn.shopify.com") {
      url.searchParams.set("width", String(width));
      return url.toString();
    }
  } catch {
    // relative or malformed — leave untouched
  }
  return src;
}
