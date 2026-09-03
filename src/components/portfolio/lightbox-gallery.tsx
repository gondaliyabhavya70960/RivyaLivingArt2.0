"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Lightbox } from "@/components/storefront/lightbox";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

export type LightboxImage = {
  /** Renderable src only ("/uploads/…" or "http…") — filtered server-side. */
  url: string;
  alt: string;
  /**
   * Mono caption for the frame — "03 · Layer 3, 36 hours in". §11.2:
   * "captions are where craft credibility lives". Omitted where the row
   * carries nothing to say; nothing is invented to fill the line.
   */
  caption?: string;
};

/**
 * Deterministic aspect rotation so the CSS columns read as a masonry wall
 * without knowing intrinsic image sizes (hydration-safe — no randomness).
 */
const TILE_ASPECTS = [
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[5/4]",
] as const;

/**
 * THE FINAL PIECE — the case study's gallery wall (REDESIGN.md §11.2).
 *
 * A CSS-columns masonry of captioned frames over a full-screen lightbox.
 * Two things the audit asked this component to fix:
 *
 * - **Duplicate frames are dropped.** `case-seaside-shell-candle` (and four
 *   other seeded cases) carry the same URL twice in `images`, so the wall
 *   showed the identical photograph side by side. De-duplication happens here
 *   rather than at the call site so every caller gets it, and it is done on
 *   the URL because that is the only thing that makes two rows the same
 *   picture. The lightbox counter then also states a truthful total.
 * - **Every frame is captioned in mono** wherever the row has something to
 *   say. The caption is the caller's — it knows the piece's title and can
 *   tell a real caption from an alt that merely repeats it.
 *
 * Tiles reveal through `MeniscusImage` (Part 14: the only image reveal on the
 * site); the lightbox image itself is not revealed — it is already the thing
 * the visitor asked for.
 */
export function LightboxGallery({ images }: { images: LightboxImage[] }) {
  // Aria copy reuses the product gallery's Product.gallery.* keys — same
  // lightbox pattern, same translations (all 9 locales).
  const t = useTranslations("Product");
  const tCommon = useTranslations("Common");
  const [index, setIndex] = useState<number | null>(null);
  // One ref per tile so the FLIP entrance and the close-focus return both
  // know exactly which button opened this particular frame (the product
  // gallery has one stage; this wall has one origin per tile).
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* One frame per distinct photograph, first occurrence wins (audit CS-02). */
  const frames = useMemo(() => {
    const seen = new Set<string>();
    return images.filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  }, [images]);

  if (frames.length === 0) return null;

  const active = index !== null ? (frames[index] ?? null) : null;

  return (
    <>
      {/* The wall */}
      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
        {frames.map((image, i) => (
          <figure key={image.url} className="mb-6 break-inside-avoid">
            <button
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              aria-label={t("gallery.showImage", {
                index: i + 1,
                count: frames.length,
              })}
              onClick={() => setIndex(i)}
              className={cn(
                "group relative block w-full cursor-zoom-in overflow-hidden rounded-image bg-sand outline-none",
                "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3",
                TILE_ASPECTS[i % TILE_ASPECTS.length],
              )}
            >
              <MeniscusImage
                src={image.url}
                alt={image.alt}
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                unoptimized={!isOptimizableImageSrc(image.url)}
                className="absolute inset-0"
                imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            </button>
            {image.caption ? (
              <figcaption className="u-micro mt-3">{image.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {/* Lightbox — the shared component; this wall keeps its own boxed
          (not full-viewport) chrome and per-frame caption. */}
      <Lightbox
        open={index !== null}
        onOpenChange={(open) => {
          if (!open) setIndex(null);
        }}
        index={index ?? 0}
        count={frames.length}
        onIndexChange={(i) => setIndex(i)}
        originFor={(i) => tileRefs.current[i] ?? null}
        labels={{
          prev: t("gallery.previousImage"),
          next: t("gallery.nextImage"),
          close: tCommon("close"),
        }}
        dialogTitle={t("gallery.lightboxTitle", {
          title: active?.alt ?? "",
          index: (index ?? 0) + 1,
          count: frames.length,
        })}
        statusText={
          active
            ? t("gallery.lightboxStatus", {
                index: (index ?? 0) + 1,
                count: frames.length,
                alt: active.alt,
              })
            : ""
        }
        /* Navy lightbox scope: the shared close button re-inks for the dark
           surface (same recipe as the product gallery). Boxed, not
           full-viewport — the one visual difference from `gallery.tsx`. */
        contentClassName="max-w-[96vw] p-3 sm:max-w-5xl sm:p-4"
      >
        {active ? (
          <figure className="flex flex-col gap-3">
            <div className="relative h-[72svh] w-full overflow-hidden rounded-image">
              <Image
                src={active.url}
                alt={active.alt}
                fill
                sizes="96vw"
                unoptimized={!isOptimizableImageSrc(active.url)}
                className="object-contain"
              />
            </div>
            {active.caption ? (
              <figcaption className="u-micro text-center">
                {active.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </Lightbox>
    </>
  );
}
