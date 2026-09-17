import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { Link } from "@/i18n/navigation";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { cn, monogram } from "@/lib/utils";

/**
 * CollectionCard — REDESIGN.md §4.6.
 *
 * "Large editorial tile, not a small ecommerce card." A 3:4 photograph, the
 * collection name in display type, and one line of promise with an arrow:
 *
 *     PRESERVE
 *     Keep the day forever →
 *
 * The homepage reduces the site's many visible categories to six of these
 * (§6 05) — they absorb both the eight-link collections list and the separate
 * "three studios" block, which currently compete on adjacent screens.
 *
 * The name goes over the image on a dark scrim rather than under it: a
 * collection is a doorway, and a caption beneath a photograph reads as a
 * product. The whole tile is the target; there is no button.
 */
export function CollectionCard({
  href,
  name,
  promise,
  image,
  imageAlt,
  ratio = "3/4",
  className,
  priority = false,
  children,
}: {
  href: string;
  /** Rendered as the mono index label — PRESERVE, KEEP, LIVE, GIFT… */
  name: string;
  /** One line: "Keep the day forever". */
  promise: ReactNode;
  image?: string | null;
  imageAlt?: string;
  ratio?: "3/4" | "4/5" | "1/1";
  className?: string;
  priority?: boolean;
  /** Optional mono footnote — a count, a lead time. Rarely used: §7.3 warns
   *  that a "139 pieces" label on a candle-holder category reads as dropship,
   *  not atelier. */
  children?: ReactNode;
}) {
  const renderable = isRenderableSrc(image);
  const aspect =
    ratio === "1/1"
      ? "aspect-square"
      : ratio === "4/5"
        ? "aspect-[4/5]"
        : "aspect-[3/4]";

  return (
    <article className={cn("group relative", className)}>
      {/* ONE grid cell holds both layers, and that is load-bearing rather than
          a styling preference.

          The text used to be `absolute inset-x-0 bottom-0` INSIDE the clipped
          photo box, which made it the nearest positioned ancestor of the
          link's `after:inset-0` overlay — so the tile's hit area and its focus
          ring were the caption block, not the tile. The photograph was dead to
          the pointer, against this component's own header ("The whole tile is
          the target; there is no button"), and `overflow-hidden` cut the
          ring's 3px offset off.

          Grid stacking puts both layers in `col-start-1 row-start-1` with no
          `position` on the text at all — later DOM paints on top — so the
          overlay resolves against THIS box, the whole tile, and the clipping
          stays where it belongs: on the photo, which is the only thing that
          scales on hover. */}
      <div className={cn("relative grid rounded-image", aspect)}>
        {/* `relative` is required, not decorative: the image and the scrim are
            `absolute`, and if their containing block were the OUTER grid box
            (an ancestor of this clipper) `overflow-hidden` here would not
            clip them — the hover scale would spill past the tile. */}
        <div className="relative col-start-1 row-start-1 overflow-hidden rounded-image">
          {renderable && image ? (
            <MeniscusImage
              src={sizedExternalSrc(image, 900)}
              alt={imageAlt ?? ""}
              fill
              sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 90vw"
              priority={priority}
              unoptimized={!isOptimizableImageSrc(image)}
              className="absolute inset-0"
              imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-deep-ocean font-display text-61 text-mineral/70"
            >
              {monogram(name)}
            </span>
          )}
          {/* A single bottom-weighted scrim, not a full-tile wash — the
              photograph stays the subject. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-obsidian/85 via-obsidian/35 to-transparent"
          />
        </div>
        {/* `z-10` on a GRID ITEM, which takes z-index without `position` —
            and that is the whole trick. The photo layer's children are
            `absolute`, so they paint in the positioned layer, above in-flow
            content: without this the eyebrow and the arrow (both static) sat
            UNDER the photograph while the promise (a `relative` span) sat over
            it. Ordering by z-index instead of by position keeps this box
            static, which is what lets the link's overlay resolve against the
            whole tile rather than against this caption. */}
        <div
          data-theme="navy"
          className="z-10 col-start-1 row-start-1 flex flex-col justify-end gap-1.5 p-5 md:p-6"
        >
          <p className="u-micro text-champagne">{name}</p>
          <h3 className="font-display text-h3 leading-h3 text-mineral">
            <Link
              href={href}
              className="inline-flex items-baseline gap-2 outline-none after:absolute after:inset-0 after:rounded-image focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
            >
              <span className="relative after:absolute after:-bottom-1 after:start-0 after:h-px after:w-0 after:bg-mineral after:transition-[width] after:duration-(--dur-base) after:ease-(--ease-luxury) group-hover:after:w-full motion-reduce:after:transition-none">
                {promise}
              </span>
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-5 shrink-0 self-center rtl:-scale-x-100"
              />
            </Link>
          </h3>
          {children ? <p className="u-micro text-mist">{children}</p> : null}
        </div>
      </div>
    </article>
  );
}
