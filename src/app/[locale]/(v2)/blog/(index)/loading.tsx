import { Skeleton, SkeletonLine } from "@/components/storefront/skeletons";

/**
 * /blog pending UI — REDESIGN.md §4.6 · Part 16: "Flat sand blocks at exact
 * final dimensions. Text lines render as 1px hairlines at the right widths.
 * No shimmer."
 *
 * It mirrors the rebuilt journal index band for band — mineral masthead with
 * the category rail, sand lead story, mineral three-up archive — so the page
 * does not re-flow when the real content lands. Every block is decorative and
 * `aria-hidden`; the wrapper announces the busy state once, language-free, so
 * this file needs no translations and cannot block on message loading.
 */
export default function BlogLoading() {
  return (
    <div role="status" aria-busy="true">
      {/* 01 · Masthead + category rail */}
      <section className="section-standard bg-background">
        <div className="u-shell flex flex-col gap-12">
          <SkeletonLine className="h-4 w-40" />

          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-5 lg:col-span-7">
              <SkeletonLine className="h-4 w-28" />
              <Skeleton className="h-16 w-full max-w-xl md:h-24" />
            </div>
            <div className="flex flex-col gap-2 lg:col-span-4 lg:col-start-9">
              <SkeletonLine className="h-5 w-full" />
              <SkeletonLine className="h-5 w-4/5" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-32 rounded-full" />
            ))}
          </div>
        </div>
      </section>

      {/* 02 · The lead story */}
      <section className="section-standard bg-sand">
        <div className="u-shell flex flex-col gap-10">
          <SkeletonLine className="h-4 w-32" />
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-x-12">
            <Skeleton className="aspect-[16/10] w-full lg:col-span-7" />
            <div className="flex flex-col gap-3 lg:col-span-4 lg:col-start-9">
              <SkeletonLine className="h-4 w-28" />
              <Skeleton className="h-10 w-full md:h-14" />
              <SkeletonLine className="mt-2 h-5 w-full" />
              <SkeletonLine className="h-5 w-11/12" />
              <SkeletonLine className="h-5 w-2/3" />
              <SkeletonLine className="mt-2 h-4 w-40" />
            </div>
          </div>
        </div>
      </section>

      {/* 03 · The archive — three up, no borders */}
      <section className="section-standard bg-background">
        <div className="u-shell flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <SkeletonLine className="h-4 w-28" />
            <Skeleton className="h-10 w-full max-w-lg md:h-14" />
          </div>
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-4">
                <Skeleton className="aspect-[4/3] w-full" />
                <SkeletonLine className="h-4 w-24" />
                <Skeleton className="h-7 w-full" />
                <SkeletonLine className="h-5 w-full" />
                <SkeletonLine className="h-5 w-3/5" />
                <SkeletonLine className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
