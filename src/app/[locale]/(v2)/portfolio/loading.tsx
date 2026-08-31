import { Skeleton, SkeletonLine } from "@/components/storefront/skeletons";

/**
 * `/portfolio` pending UI — REDESIGN.md §4.6 (`Skeleton`) and Part 16.
 *
 * The archive at first paint: the dark hero band that pulls under the
 * transparent header, the chip row, then the wall in the same masonry the
 * real grid uses — large `2×2`, vertical `1×2`, two small `1×1`, repeating —
 * so nothing shifts when the cases land.
 *
 * Flat sand blocks at exact final dimensions, text as 1px hairlines, no
 * shimmer and no spinner. The wrapper announces the busy state once,
 * language-free; every block below it is decorative.
 */

/** The same four-tile pattern `sizeFor()` lays out in page.tsx. */
const SPANS = ["md:col-span-2 md:row-span-2", "md:row-span-2", "", ""] as const;

const RATIOS = ["aspect-[4/3]", "aspect-[4/5]", "aspect-[4/3]", "aspect-[4/3]"];

export default function PortfolioLoading() {
  return (
    <div role="status" aria-busy="true" className="bg-mineral">
      {/* Dark hero band — trail, eyebrow, headline, standfirst, index line. */}
      <section
        data-theme="navy"
        className="-mt-20 flex min-h-[70svh] flex-col justify-end bg-obsidian"
      >
        <div className="u-shell flex flex-col gap-8 pt-32 pb-20">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-14 w-full max-w-xl md:h-20 md:max-w-3xl" />
          <div className="flex w-full max-w-2xl flex-col gap-2">
            <SkeletonLine className="h-6 w-full" />
            <SkeletonLine className="h-6 w-3/4" />
          </div>
          <Skeleton className="h-3 w-64" />
        </div>
      </section>

      <section className="section-standard bg-mineral">
        <div className="u-shell flex flex-col gap-10">
          {/* Chip row */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-32 rounded-full" />
            ))}
          </div>

          {/* The wall */}
          <div className="grid grid-cols-1 gap-4 md:auto-rows-[15rem] md:grid-cols-2 md:gap-6 lg:auto-rows-[13.5rem] lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={SPANS[i % 4]}>
                <Skeleton
                  className={`w-full ${RATIOS[i % 4]} md:aspect-auto md:h-full`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
