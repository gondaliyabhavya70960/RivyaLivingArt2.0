/**
 * Turning the name a file arrives with into one that can live in a URL.
 *
 * `WhatsApp Image 2026-07-07 at 15.05.34.jpeg` must never reach production
 * (docs/studio-cms §3.4.5). It is unreadable in a URL, it tells a search engine
 * nothing, and it leaks the date and time a photograph was taken.
 *
 * The original is not thrown away — it goes into `Media.originalName`, where
 * search can still find it. An owner who remembers "the WhatsApp one from
 * July" can still type that.
 *
 * Plain module, no server imports.
 */

import { slugify } from "@/lib/slug";

/**
 * Names that carry no information about the picture.
 *
 * These are what a camera, a phone or a chat app produces, and the point of
 * matching them is to fall back to the folder name rather than shipping
 * `img-4942.jpg`. Anything not on this list is trusted — an owner who typed
 * "varmala-preservation-clock" gets exactly that.
 */
const UNINFORMATIVE = [
  /^whatsapp[ _-]?image/i,
  /^whatsapp[ _-]?video/i,
  /^img[ _-]?\d+$/i,
  /^image[ _-]?\d*$/i,
  /^photo[ _-]?\d*$/i,
  /^dsc[ _-]?\d+$/i,
  /^dscn?\d+$/i,
  /^pxl[ _-]?\d+/i,
  /^screenshot/i,
  /^untitled/i,
  /^download(\s*\(\d+\))?$/i,
  /^\d{8}[ _-]?\d{6}$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i,
];

function isUninformative(stem: string): boolean {
  const trimmed = stem.trim();
  if (trimmed.length < 3) return true;
  return UNINFORMATIVE.some((pattern) => pattern.test(trimmed));
}

/** Split "a/b/photo.final.JPEG" into its stem and lowercase extension. */
export function splitFilename(name: string): { stem: string; ext: string } {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return { stem: base, ext: "" };
  return { stem: base.slice(0, dot), ext: base.slice(dot).toLowerCase() };
}

/**
 * The stored filename for an upload, without its extension.
 *
 * `folder` is the fallback subject when the original name says nothing, so a
 * camera dump into "products" becomes `products`, `products-2`, `products-3`
 * rather than `dsc-0431`, `dsc-0432`. `index` numbers ONLY that fallback: a
 * name the owner actually chose keeps it, whatever position it happened to
 * occupy in the batch. The storage driver adds its own random suffix on top,
 * so two batches never collide either.
 */
export function seoFilename(
  originalName: string,
  folder: string,
  index = 0,
): string {
  const { stem } = splitFilename(originalName);
  const slug = slugify(stem);
  const informative = Boolean(slug) && !isUninformative(stem);
  const base = informative ? slug : slugify(folder) || "file";
  // A very long name is worse than a truncated one — URLs get pasted into
  // chats and emails, and the tail is where the meaning already ran out.
  const capped = base.slice(0, 60).replace(/-+$/, "") || "file";
  if (informative || index === 0) return capped;
  return `${capped}-${index + 1}`;
}
