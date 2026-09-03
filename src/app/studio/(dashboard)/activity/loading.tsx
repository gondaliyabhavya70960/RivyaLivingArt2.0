import {
  SkeletonFilters,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonTable,
} from "@/components/studio/skeleton";

export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <SkeletonFilters selects={2} />
      <SkeletonTable rows={12} />
    </SkeletonScreen>
  );
}
