"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Lightbox } from "@/components/storefront/lightbox";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import type { GalleryImage } from "@/lib/custom-blocks";
import { isOptimizableImageSrc, sizedExternalSrc } from "@/lib/image-src";

/**
 * The `fullscreenGallery` block's client island (C2): a grid of square
 * thumbnails, each a real button, opening the shared storefront Lightbox —
 * the same component the product gallery and the portfolio wall use, so the
 * keyboard stepping, RTL arrows, live region, focus return and FLIP entrance
 * are one implementation. Labels come from the nine-locale `Lightbox`
 * namespace; the per-frame title and status are composed from the picture's
 * own description, never invented.
 */
export function FullscreenGallery({ images }: { images: GalleryImage[] }) {
  const t = useTranslations("Lightbox");
  const [index, setIndex] = useState<number | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = index === null ? null : (images[index] ?? null);
  const position = (index ?? 0) + 1;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {images.map((image, i) => (
          <li key={`${image.url}-${i}`}>
            <button
              type="button"
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              onClick={() => setIndex(i)}
              aria-label={image.alt || `${i + 1} ${t("of")} ${images.length}`}
              className="group relative block aspect-square w-full overflow-hidden rounded-image outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3"
            >
              <MeniscusImage
                src={sizedExternalSrc(image.url, 900)}
                alt={image.alt}
                fill
                sizes="(min-width:768px) 25vw, 50vw"
                unoptimized={!isOptimizableImageSrc(image.url)}
                className="absolute inset-0"
                imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            </button>
            {image.caption ? (
              <p className="u-micro mt-2 text-graphite">{image.caption}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <Lightbox
        open={index !== null}
        onOpenChange={(open) => {
          if (!open) setIndex(null);
        }}
        index={index ?? 0}
        count={images.length}
        onIndexChange={(i) => setIndex(i)}
        originFor={(i) => tileRefs.current[i] ?? null}
        labels={{ prev: t("prev"), next: t("next"), close: t("close") }}
        dialogTitle={
          active ? `${active.alt} — ${position} ${t("of")} ${images.length}` : ""
        }
        statusText={
          active ? `${position} ${t("of")} ${images.length}: ${active.alt}` : ""
        }
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
