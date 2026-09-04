/**
 * Small, plain formatting helpers shared by the studio media library (batch D
 * · media system) — the media page, the grid/list cards, the detail drawer
 * and the picker all need the same byte/duration/orientation formatting, and
 * before this batch each one would have grown its own copy.
 *
 * Plain module: no "use client" (several call sites are server components),
 * no "use server" (nothing here mutates), no server-only import (the client
 * grid needs these too) — pure formatting, safe on either side.
 *
 * This file used to hold a set of hardcoded Cloudinary URLs
 * (`SITE_IMAGES`/`GALLERY_IMAGES`) from before the site had a media library
 * at all. Nothing imported them — `site-images.ts`'s slot registry replaced
 * that whole approach — so `docs/transformation-audit.md` §10.4 records them
 * as dead and safe to remove; this batch removes them by putting the media
 * system's own shared helpers in their place rather than leaving the file
 * empty.
 */

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** `Media.duration` is whole seconds. `null` for anything that is not a
 *  video, or a video whose duration was never captured. */
export function formatDuration(
  seconds: number | null | undefined,
): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return null;
  }
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type Orientation = "landscape" | "portrait" | "square";

/** `null` when either dimension is unknown — a 3D model or a document, or an
 *  image `sharp` could not read. */
export function deriveOrientation(
  width: number | null | undefined,
  height: number | null | undefined,
): Orientation | null {
  if (!width || !height) return null;
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

export const ORIENTATIONS = ["landscape", "portrait", "square"] as const;

/**
 * Size bands for the library's size filter (§10.1's "no ... size" gap).
 * Ordered smallest first; `max: null` means "and up".
 */
export const SIZE_BANDS = [
  { value: "small", label: "Under 250 KB", min: 0, max: 250 * 1024 },
  {
    value: "medium",
    label: "250 KB – 2 MB",
    min: 250 * 1024,
    max: 2 * 1024 * 1024,
  },
  {
    value: "large",
    label: "2 – 10 MB",
    min: 2 * 1024 * 1024,
    max: 10 * 1024 * 1024,
  },
  { value: "xlarge", label: "Over 10 MB", min: 10 * 1024 * 1024, max: null },
] as const;

export type SizeBand = (typeof SIZE_BANDS)[number]["value"];

export function isSizeBand(value: string): value is SizeBand {
  return (SIZE_BANDS as readonly { value: string }[]).some(
    (b) => b.value === value,
  );
}

/**
 * A best-effort deep link from a `findMediaUsageDetails` label to the studio
 * surface that owns it — "Product gallery ×3" opens the products list, not
 * the one product, because the label carries no id or slug to link to.
 *
 * True per-row deep links need `findMediaUsageDetails` (`media-usages.ts`)
 * to return an id/slug alongside each label — a change to a file this batch
 * does not own (B0's). This is the honest middle ground until that lands:
 * every usage line still gets somewhere useful, one click closer than a
 * label with no link at all.
 *
 * `label` is matched by its PREFIX, before " · " or " ×N" — the same shape
 * `findMediaUsageDetails` already builds every label in.
 */
const USAGE_LINKS: { prefix: string; href: string }[] = [
  { prefix: "Product gallery", href: "/studio/products" },
  { prefix: "Product video", href: "/studio/products" },
  { prefix: "Product 3D model", href: "/studio/products" },
  { prefix: "Product OG image", href: "/studio/products" },
  { prefix: "Portfolio gallery", href: "/studio/portfolio" },
  { prefix: "Portfolio before/after", href: "/studio/portfolio" },
  { prefix: "Portfolio film", href: "/studio/portfolio" },
  { prefix: "Category cover", href: "/studio/categories" },
  { prefix: "Blog cover", href: "/studio/blog" },
  { prefix: "Blog post", href: "/studio/blog" },
  { prefix: "Site logo", href: "/studio/settings" },
  { prefix: "Home hero video", href: "/studio/settings" },
  { prefix: "Favicon", href: "/studio/settings" },
  { prefix: "App icon", href: "/studio/settings" },
  { prefix: "Default sharing picture", href: "/studio/seo" },
  { prefix: "Testimonial", href: "/studio/testimonials" },
  { prefix: "Site image", href: "/studio/site-images" },
  { prefix: "Landing page", href: "/studio/custom-pages" },
  { prefix: "Page", href: "/studio/pages" },
];

export function usageLink(label: string): string | null {
  const withoutCount = label.replace(/\s*×\d+$/, "");
  const prefix = withoutCount.split(" · ")[0]?.trim() ?? withoutCount;
  return USAGE_LINKS.find((entry) => entry.prefix === prefix)?.href ?? null;
}
