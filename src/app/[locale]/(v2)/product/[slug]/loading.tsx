import {
  ProductCardSkeleton,
  Skeleton,
  SkeletonLine,
  TextSkeleton,
} from "@/components/storefront/skeletons";

/**
 * PDP pending UI — mirrors the Part 9 first paint: breadcrumb, the 60/40
 * commerce split (vertical thumbnail rail beside a 4:5 stage, information
 * column beside it), then the sand customize band and the single related
 * rail. Flat sand blocks at final dimensions, no shimmer, no spinner; the
 * wrapper announces its busy state language-free.
 */
export default function ProductLoading() {
  return (
    <div role="status" aria-busy="true" className="bg-mineral">
      <div className="u-shell section-compact">
        <SkeletonLine className="h-4 w-72" />

        <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
          {/* Gallery — rail + stage */}
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
            <div className="order-2 flex gap-3 lg:order-1 lg:w-20 lg:shrink-0 lg:flex-col">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="size-16 shrink-0 lg:size-20" />
              ))}
            </div>
            <Skeleton className="order-1 aspect-[4/5] w-full flex-1 lg:order-2" />
          </div>

          {/* Information panel */}
          <div className="flex flex-col gap-5">
            <SkeletonLine className="h-4 w-32" />
            <Skeleton className="h-10 w-4/5" />
            <SkeletonLine className="h-6 w-28" />
            <TextSkeleton lines={3} />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-28" />
            </div>
            <Skeleton className="mt-2 h-14 w-full rounded-full" />
            <Skeleton className="h-14 w-full rounded-full" />
            <div className="mt-6 border-t border-hairline">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonLine
                  key={i}
                  className="h-12 w-3/4 border-b border-hairline"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Customize band */}
      <div className="section-standard bg-sand">
        <div className="u-shell flex flex-col gap-10">
          <SkeletonLine className="h-4 w-28" />
          <Skeleton className="h-10 w-80" />
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-16">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <Skeleton className="h-14 w-full rounded-full" />
            </div>
            <Skeleton className="h-64 w-full lg:col-span-4 lg:col-start-9" />
          </div>
        </div>
      </div>

      {/* Related rail */}
      <div className="u-shell section-standard">
        <Skeleton className="h-9 w-64" />
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4 lg:gap-x-8">
          {Array.from({ length: 4 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
