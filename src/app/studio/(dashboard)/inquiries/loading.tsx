import {
  SkeletonFilters,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonTable,
} from "@/components/studio/skeleton";

/** Commissions: header, saved views, filters, then the list. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <div className="mb-4 h-12 w-96 max-w-full rounded-full bg-foreground/6" />
      <SkeletonFilters selects={2} />
      <SkeletonTable rows={10} />
    </SkeletonScreen>
  );
}
