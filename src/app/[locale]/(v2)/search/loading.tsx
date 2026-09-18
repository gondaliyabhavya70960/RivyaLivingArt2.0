import {
  ProductCardSkeleton,
  Skeleton,
} from "@/components/storefront/skeletons";

/**
 * /search pending UI (H11). Mirrors the v2.0 utility masthead at first
 * paint — trail line, eyebrow + Fraunces head, the query form row, the
 * status line, then one index head over a catalog card grid — while the
 * ILIKE scans run server-side. No text, no spinner: the wrapper announces
 * busy state (`role="status" aria-busy`) language-free; every block is a
 * decorative token-only skeleton on the canvas ground.
 */
export default function SearchLoading() {
  return (
    <section
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-shell bg-background px-5 pt-4 pb-16 md:px-6 md:pb-24"
    >
      {/* Breadcrumb line */}
      <Skeleton className="h-4 w-36" />

      {/* Masthead — eyebrow, Fraunces headline */}
      <header className="mt-6 max-w-2xl md:mt-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-10 w-64 md:h-12 md:w-80" />

        {/* Query form row — input + submit silhouettes */}
        <div className="mt-6 flex max-w-xl items-center gap-3 md:mt-8">
          <Skeleton className="h-11 min-w-0 flex-1" />
          <Skeleton className="h-11 w-28 shrink-0" />
        </div>

        {/* Results-count line */}
        <Skeleton className="mt-4 h-4 w-56" />
      </header>

      {/* Results index — section head over the catalog card grid */}
      <div className="mt-12 md:mt-16">
        <div className="flex items-end justify-between gap-6">
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-48 md:h-8" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
