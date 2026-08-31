import { cn } from "@/lib/utils";

/**
 * Storefront skeletons — REDESIGN.md §4.6 · Part 16.
 *
 * "Flat sand blocks at exact final dimensions. Text lines render as 1px
 * hairlines at the right widths. No shimmer — it fights the meniscus
 * language. Never a spinner where a skeleton will do."
 *
 * Three consequences worth stating, because each of them undoes something
 * the previous version did:
 *
 * - **No `animate-pulse`, anywhere.** The site has exactly one motion idea
 *   for content arriving — the meniscus edge rising through a frame (§2.7).
 *   A shimmer or a pulse is a second, competing one, and a pulsing grid is
 *   the loudest thing on a page whose whole argument is restraint. The
 *   skeletons are simply still. That also means there is nothing here for
 *   the reduced-motion collapse to switch off.
 * - **Sand, not hairline.** These are surfaces standing in for photographs,
 *   so they are drawn in the warm neutral the real card surface uses
 *   (Part 3.1). `hairline` is reserved for rules, and rules are what text
 *   becomes.
 * - **Text is a rule, not a bar.** A 16px grey bar per line of copy reads as
 *   a wireframe. A 1px hairline centred in the line box reads as ruled paper
 *   and keeps the block at its true height, so nothing shifts when the real
 *   words land. `SkeletonLine` owns that; `Skeleton` stays the block.
 *
 * Everything is `aria-hidden`: the pending pages announce their busy state
 * once on the wrapper (`role="status" aria-busy`), language-free, and a
 * screen reader has nothing to gain from counting placeholders.
 */

/**
 * The block. A flat sand rectangle at the exact size of the thing it stands
 * in for — pass the real dimensions (`aspect-[4/5] w-full`, `size-16`,
 * `h-12 w-48`) rather than an approximation, so first paint and hydrated
 * paint agree. Radius defaults to `rounded-image` (2px, Part 3.5); callers
 * standing in for a card or a pill override it.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="sf-skeleton"
      aria-hidden
      className={cn(
        "rounded-image bg-sand in-data-[theme=navy]:bg-deep-ocean",
        className,
      )}
    />
  );
}

/**
 * One line of text. The wrapper carries the line's height so the block keeps
 * its final dimensions; only the 1px rule inside it is painted, at the
 * wrapper's width. Set both on `className`: `<SkeletonLine className="h-6
 * w-3/5" />` is a 24px line box holding a hairline three-fifths across.
 */
export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      data-slot="sf-skeleton-line"
      aria-hidden
      className={cn("flex h-5 w-full items-center", className)}
    >
      <span className="block h-px w-full bg-hairline in-data-[theme=navy]:bg-hairline-dk" />
    </div>
  );
}

/**
 * A paragraph. Last line runs short, the way real copy does — the only
 * "realism" worth spending anything on, because a block of equal-length
 * rules reads as a table.
 */
export function TextSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const count = Math.max(1, lines);

  return (
    <div
      data-slot="sf-text-skeleton"
      aria-hidden
      className={cn("space-y-1", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonLine
          key={i}
          className={i === count - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

/**
 * Mirrors `ProductCard` (§4.6): a 4:5 image, then the mono collection line,
 * the piece name over its two-line clamp, the price and the "made to order"
 * line. No card surface and no border — the redesigned card is an image with
 * type beneath it, so a skeleton that drew a filled panel would promise a box
 * that never arrives. The two title lines are reserved unconditionally: the
 * clamp is two lines, and collapsing to one here is what makes a grid jump
 * when the names land.
 */
export function ProductCardSkeleton() {
  return (
    <div data-slot="sf-product-card-skeleton" aria-hidden className="w-full">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="mt-4">
        {/* COLLECTION — mono micro */}
        <SkeletonLine className="h-4 w-24" />
        {/* Piece name — Inter 500, clamped to two lines */}
        <SkeletonLine className="mt-2 h-6 w-full" />
        <SkeletonLine className="h-6 w-3/5" />
        {/* Price — mono tabular */}
        <SkeletonLine className="mt-2 h-5 w-20" />
        {/* Made to order — mono micro */}
        <SkeletonLine className="mt-1 h-4 w-28" />
      </div>
    </div>
  );
}
