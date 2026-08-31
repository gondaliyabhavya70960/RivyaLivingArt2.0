import {
  ProductCardSkeleton,
  Skeleton,
  SkeletonLine,
} from "@/components/storefront/skeletons";

/**
 * /shop/[category] pending UI — mirrors the Part 8 landing page at first
 * paint: the full-bleed hero block, the cols 1–7 explanation, the 64px
 * toolbar and nine grid cards (§7.8). No text, no spinner; the wrapper
 * announces busy state language-free and every block is a flat sand skeleton
 * at its final dimensions.
 */
export default function ShopCategoryLoading() {
  return (
    <div role="status" aria-busy="true" className="bg-mineral">
      {/* Hero — the full-bleed photograph and its overlaid identity */}
      <div className="flex min-h-[62svh] items-end bg-obsidian">
        <div className="u-shell flex flex-col gap-6 pt-16 pb-16 md:pt-20 md:pb-20">
          <Skeleton className="h-4 w-48 bg-mineral/10" />
          <Skeleton className="h-4 w-28 bg-mineral/10" />
          <Skeleton className="h-14 w-80 bg-mineral/10 md:h-20 md:w-[32rem]" />
          <Skeleton className="h-14 w-44 rounded-full bg-mineral/10" />
        </div>
      </div>

      {/* Explanation — cols 1–7 */}
      <div className="u-shell section-standard grid gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-7 w-full" />
          <SkeletonLine className="h-7 w-11/12" />
          <SkeletonLine className="h-7 w-2/3" />
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
