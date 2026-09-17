import { ArrowRight } from "lucide-react";

import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { Link } from "@/i18n/navigation";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { monogram } from "@/lib/utils";

export type CollectionDoor = {
  href: string;
  /** Mono eyebrow — PRESERVE, KEEP, LIVE, GIFT… */
  name: string;
  /** Display line — "Keep the day forever". */
  promise: string;
  image?: string | null;
  imageAlt?: string;
};

/**
 * CollectionDoors — the six collection tiles as hover-expanding doorways
 * (Liquid Luxury v3.1, branch `redesign/liquid-luxury`).
 *
 * Same content and destinations as the bento grid they replace; only the
 * vessel changes. On desktop the doors share one full-height flex row —
 * hovering a door lets it take ~2.4× the space while its siblings dim, so
 * the visitor reads one world at a time. On touch the doors stack
 * vertically at 38vh each with every caption visible. The expansion itself
 * is pure CSS (`flex` transition), so there is nothing to hydrate, nothing
 * to break under reduced motion, and no JS on this band at all.
 *
 * A tile with no photograph keeps the deep-ocean monogram fallback the
 * bento grid used — an unpictured doorway still announces itself.
 */
export function CollectionDoors({ tiles }: { tiles: readonly CollectionDoor[] }) {
  return (
    <div className="cd-doors">
      {tiles.map((tile) => {
        const renderable = isRenderableSrc(tile.image);
        return (
          <Link key={tile.name} href={tile.href} className="cd-door group">
            {renderable && tile.image ? (
              <MeniscusImage
                src={sizedExternalSrc(tile.image, 1000)}
                alt={tile.imageAlt ?? ""}
                fill
                sizes="(min-width:1024px) 34vw, 90vw"
                unoptimized={!isOptimizableImageSrc(tile.image)}
                className="cd-media absolute inset-0"
                imageClassName="object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="cd-media flex h-full w-full items-center justify-center bg-deep-ocean font-display text-61 text-mineral/70"
              >
                {monogram(tile.name)}
              </span>
            )}
            {/* Bottom-weighted scrim — the photograph stays the subject. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-obsidian/85 via-obsidian/35 to-transparent"
            />
            <span data-theme="navy" className="cd-info">
              <span className="u-micro block text-champagne">{tile.name}</span>
              <span className="block font-display text-h3 leading-h3 text-mineral">
                {tile.promise}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              strokeWidth={1.5}
              className="cd-arrow size-5 rtl:-scale-x-100"
            />
          </Link>
        );
      })}
    </div>
  );
}
