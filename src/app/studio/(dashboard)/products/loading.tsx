import {
  SkeletonFilters,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonTable,
} from "@/components/studio/skeleton";

/** Products: header, the status tabs, four filters, then the 25-row table. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <div className="mb-4 h-12 w-80 max-w-full rounded-full bg-foreground/6" />
      <SkeletonFilters selects={3} />
      <SkeletonTable rows={10} />
    </SkeletonScreen>
  );
}
