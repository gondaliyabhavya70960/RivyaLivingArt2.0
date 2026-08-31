"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Filter chips — REDESIGN.md §4.6 (`Active filter chips`) and §7.5.
 *
 * Two exports, one grammar:
 *
 * - `FilterChip` is the toggle used inside the filter drawer (§4.6
 *   `FilterDrawer`). A pill on a hairline; selecting it fills the pill with
 *   sand and turns the label sapphire, and adds weight plus an `×`, so state
 *   is never carried by colour alone (Part 17).
 * - `ActiveFilters` is the row that sits directly under the shop toolbar.
 *   §7.5 calls it "the single most important missing control on the current
 *   shop page — you cannot presently see or undo what you have applied":
 *   one chip per active filter with an `×`, a `Clear all` ghost action, and a
 *   live result count in mono.
 *
 * Both are client components — toggling and removing are real interactivity —
 * and both take copy pre-translated from the caller. `ActiveFilters` is
 * deliberately data-shaped: it never learns the filter model, only that a
 * filter has an id, a label and a way to remove itself.
 */

/* Part 16: 2px sapphire ring at 3px offset, champagne inside a dark band. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral in-data-[theme=navy]:focus-visible:ring-offset-obsidian";

/* h-11 is the Part 17 tap floor; rounded-full is the one full-round shape in
   the system (Part 3.5), shared with buttons. */
const PILL =
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-hairline px-4 font-body text-small whitespace-nowrap transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none in-data-[theme=navy]:border-hairline-dk";

export function FilterChip({
  label,
  selected,
  onToggle,
  removable,
}: {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  /** Show the `×` while selected — for chips that toggle a filter off. */
  removable?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="sf-filter-chip"
      aria-pressed={selected === true}
      onClick={onToggle}
      className={cn(
        PILL,
        FOCUS_RING,
        selected
          ? "bg-sand font-medium text-sapphire in-data-[theme=navy]:text-champagne"
          : "bg-transparent text-ink hover:bg-sand in-data-[theme=navy]:text-mineral",
      )}
    >
      {label}
      {selected && removable ? (
        <X aria-hidden strokeWidth={1.5} className="-me-1 size-4" />
      ) : null}
    </button>
  );
}

export type ActiveFilter = {
  /** Stable key — the filter's own identity, not its index. */
  id: string;
  /** Pre-translated chip text, e.g. "Under ₹2,000". */
  label: string;
  onRemove: () => void;
};

export function ActiveFilters({
  filters,
  count,
  countLabel,
  onClearAll,
  clearAllLabel,
  removeLabel,
  className,
}: {
  filters: ActiveFilter[];
  /** Live result count. Rendered in mono, per §7.5. */
  count: number;
  /**
   * The translated noun that follows the count — "pieces", "قطعة". Pluralised
   * by the caller through next-intl, since only it knows the locale's rules.
   */
  countLabel: string;
  onClearAll: () => void;
  clearAllLabel: string;
  /**
   * Optional template for each chip's accessible name, carrying a "{filter}"
   * placeholder, e.g. "Remove {filter}". Without it the chip announces its
   * label alone.
   */
  removeLabel?: string;
  className?: string;
}) {
  /* Part 16: conditionally rendered, never an empty rail. With nothing
     applied there is nothing to see or undo, and the toolbar keeps its
     whitespace. */
  if (filters.length === 0) return null;

  return (
    <div
      data-slot="sf-active-filters"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={filter.onRemove}
          aria-label={removeLabel?.replace("{filter}", filter.label)}
          className={cn(
            PILL,
            FOCUS_RING,
            "bg-sand text-sapphire hover:text-ink in-data-[theme=navy]:text-champagne",
          )}
        >
          {filter.label}
          <X aria-hidden strokeWidth={1.5} className="-me-1 size-4" />
        </button>
      ))}

      {/* Ghost action, not a button object — Part 3.6 keeps `Clear all`
          quieter than anything that adds a filter. */}
      <button
        type="button"
        onClick={onClearAll}
        className={cn(
          "inline-flex h-11 shrink-0 items-center rounded-input px-2 font-body text-small text-graphite underline underline-offset-4",
          "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire motion-reduce:transition-none",
          "in-data-[theme=navy]:hover:text-champagne",
          FOCUS_RING,
        )}
      >
        {clearAllLabel}
      </button>

      {/* Live count: mono micro, announced politely as the grid re-filters. */}
      <p role="status" className="u-micro ms-auto whitespace-nowrap">
        {count} {countLabel}
      </p>
    </div>
  );
}
