import {
  SkeletonBlock,
  SkeletonPageHeader,
  SkeletonScreen,
} from "@/components/studio/skeleton";

/**
 * The form's shape without the parent list's table rows: header, the five-tab
 * strip, then one section-sized block — composed from the shared skeleton
 * primitives rather than the list skeleton every other `/studio/testimonials`
 * route falls back to.
 */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <div className="mb-6 flex gap-6 border-b border-border pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-4 w-20" />
        ))}
      </div>
      <div className="space-y-4 rounded-card border border-border bg-card p-6 shadow-e1">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-11 w-full max-w-80" />
      </div>
    </SkeletonScreen>
  );
}
