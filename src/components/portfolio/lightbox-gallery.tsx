"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/storefront/dialog";
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
  // Lightbox close returns focus to the tile that opened it — the dialog is
  // state-controlled with no Radix trigger to restore to (A11Y-405, matching
  // the product gallery's UIUX-P17 fix).
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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

  function step(delta: number) {
    setIndex((i) =>
      i === null ? i : (i + delta + frames.length) % frames.length,
    );
  }

  return (
    <>
      {/* The wall */}
      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
        {frames.map((image, i) => (
          <figure key={image.url} className="mb-6 break-inside-avoid">
            <button
              type="button"
              aria-label={t("gallery.showImage", {
                index: i + 1,
                count: frames.length,
              })}
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                setIndex(i);
              }}
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

      {/* Lightbox */}
      <Dialog
        open={index !== null}
        onOpenChange={(open) => {
          if (!open) setIndex(null);
        }}
      >
        <DialogContent
          closeLabel={tCommon("close")}
          /* Navy lightbox scope: the shared close button re-inks for the
             dark surface (same recipe as the product gallery). */
          data-theme="navy"
          className="max-w-[96vw] bg-obsidian/95 p-3 text-mineral sm:max-w-5xl sm:p-4 [&_[data-slot=sf-dialog-close]]:text-mist [&_[data-slot=sf-dialog-close]]:hover:text-mineral"
          onKeyDown={(e) => {
            // Direction-aware: under RTL the chevrons mirror, so the key
            // that visually points at "next" must advance (Part 0 A2-006).
            const rtl =
              e.currentTarget.closest("[dir]")?.getAttribute("dir") === "rtl" ||
              document.documentElement.dir === "rtl";
            if (e.key === "ArrowRight") step(rtl ? -1 : 1);
            if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">
            {t("gallery.lightboxTitle", {
              title: active?.alt ?? "",
              index: index !== null ? index + 1 : 1,
              count: frames.length,
            })}
          </DialogTitle>

          {/* Live region — prev/next changes are otherwise silent to screen
              readers; announces "Image N of M: {alt}" on every step (same
              pattern as the product gallery). */}
          <p role="status" aria-live="polite" className="sr-only">
            {active &&
              t("gallery.lightboxStatus", {
                index: index !== null ? index + 1 : 1,
                count: frames.length,
                alt: active.alt,
              })}
          </p>

          {active && (
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
          )}

          {frames.length > 1 && (
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label={t("gallery.previousImage")}
                onClick={() => step(-1)}
                className="inline-flex size-12 items-center justify-center rounded-full border border-hairline-dk outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-mineral/40 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-obsidian motion-reduce:transition-none"
              >
                <ChevronLeft
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-5 rtl:-scale-x-100"
                />
              </button>
              <p className="u-num text-14 text-mist">
                {t("gallery.counter", {
                  index: index !== null ? index + 1 : 1,
                  count: frames.length,
                })}
              </p>
              <button
                type="button"
                aria-label={t("gallery.nextImage")}
                onClick={() => step(1)}
                className="inline-flex size-12 items-center justify-center rounded-full border border-hairline-dk outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-mineral/40 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-obsidian motion-reduce:transition-none"
              >
                <ChevronRight
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-5 rtl:-scale-x-100"
                />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
