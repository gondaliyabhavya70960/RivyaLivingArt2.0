import {
  SkeletonFilters,
  SkeletonGrid,
  SkeletonPageHeader,
  SkeletonScreen,
} from "@/components/studio/skeleton";

/** The media library is a grid, not a table — its placeholder is too. */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <SkeletonFilters selects={2} />
      <SkeletonGrid tiles={18} />
    </SkeletonScreen>
  );
}
