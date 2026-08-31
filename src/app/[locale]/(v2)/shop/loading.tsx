import {
  ProductCardSkeleton,
  Skeleton,
  SkeletonLine,
} from "@/components/storefront/skeletons";

/**
 * /shop pending UI — REDESIGN.md §7.8: "nine flat skeleton cards, filters
 * stay interactive." Mirrors the rebuilt page's first paint (compact
 * masthead → text tabs → collection strip → 64px toolbar → 3-up grid) so the
 * navigation feels answered instantly while the RSC payload streams.
 *
 * No text and no spinner: the wrapper announces its busy state language-free
 * and every block is a decorative sand skeleton at its final dimensions.
 */
export default function ShopLoading() {
  return (
    <div role="status" aria-busy="true" className="bg-mineral">
      {/* Masthead */}
      <div className="u-shell section-compact flex flex-col gap-6">
        <SkeletonLine className="h-4 w-40" />
        <Skeleton className="h-12 w-72 md:h-16 md:w-96" />
        <SkeletonLine className="h-5 w-full max-w-md" />
      </div>

      {/* Category tabs */}
      <div className="u-shell">
        <div className="flex items-end gap-8 border-b border-hairline pb-4">
          {["w-16", "w-32", "w-24", "w-28", "w-36"].map((w) => (
            <Skeleton key={w} className={`h-7 ${w}`} />
          ))}
        </div>
      </div>

      {/* Collection strip */}
      <div className="section-standard bg-sand">
        <div className="u-shell flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <SkeletonLine className="h-4 w-28" />
            <Skeleton className="h-10 w-80" />
          </div>
          <div className="flex gap-6 overflow-hidden">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton
                key={i}
                className="aspect-[3/4] w-[66vw] max-w-[19rem] shrink-0 sm:w-[38vw] lg:w-[17rem]"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-y border-hairline">
        <div className="u-shell flex h-16 items-center gap-6">
          <SkeletonLine className="h-5 w-56" />
          <Skeleton className="ms-auto h-11 w-32 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>

      {/* Grid — nine cards (§7.8) */}
      <div className="u-shell pt-8 pb-20 md:pb-28">
        <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8">
          {Array.from({ length: 9 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
