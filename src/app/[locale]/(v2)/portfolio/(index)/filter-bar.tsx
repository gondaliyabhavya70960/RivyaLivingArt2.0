"use client";

import { useRouter } from "@/i18n/navigation";
import { ActiveFilters } from "@/components/storefront/filter-chip";

/**
 * The archive's "what am I looking at, and how do I undo it" row —
 * REDESIGN.md §4.6 (`Active filter chips`) and §11.1.
 *
 * The category chips themselves stay server-rendered `<Link>`s in
 * `page.tsx`: they are bookmarkable, crawlable and work without JavaScript,
 * and losing that to gain a click handler would be a bad trade. What *does*
 * need a handler is the shared `ActiveFilters` control — one chip carrying
 * the applied filter with an `×`, `Clear all`, and the live result count in
 * mono — so it lives here, in the one small client island the archive needs.
 *
 * Removing a filter navigates to exactly the URL the corresponding link
 * points at, so the route contract is unchanged: `/portfolio` and
 * `/portfolio?category=…` remain the only two shapes.
 */
export function PortfolioActiveFilters({
  label,
  clearHref,
  count,
  countLabel,
  clearAllLabel,
  removeLabel,
}: {
  /** The applied category's name — null while nothing is filtered. */
  label: string | null;
  /** Where "remove" and "clear all" both go: the unfiltered archive. */
  clearHref: string;
  count: number;
  countLabel: string;
  clearAllLabel: string;
  removeLabel: string;
}) {
  const router = useRouter();
  if (!label) return null;

  const clear = () => router.push(clearHref);

  return (
    <ActiveFilters
      filters={[{ id: "category", label, onRemove: clear }]}
      count={count}
      countLabel={countLabel}
      onClearAll={clear}
      clearAllLabel={clearAllLabel}
      removeLabel={removeLabel}
    />
  );
}
