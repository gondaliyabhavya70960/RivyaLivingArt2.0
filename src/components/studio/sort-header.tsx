"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };

type Comparable = string | number | boolean | null | undefined;

function compareValues(a: Comparable, b: Comparable): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Client-side column sort for the studio tables. `getValue(row, key)` returns
 * the comparable for the active column. Null/undefined always sort LAST,
 * regardless of direction (so blank cells never jump to the top on desc).
 * Rows are copied before sorting, so the source array is never mutated.
 */
export function useSort<T>(
  rows: T[],
  getValue: (row: T, key: string) => Comparable,
  initial: SortState,
) {
  const [sort, setSort] = useState<SortState>(initial);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getValue(a, sort.key);
      const bv = getValue(b, sort.key);
      const aNull = av === null || av === undefined || av === "";
      const bNull = bv === null || bv === undefined || bv === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1; // nulls last, unaffected by dir
      if (bNull) return -1;
      return compareValues(av, bv) * dir;
    });
  }, [rows, sort, getValue]);

  const toggle = useCallback((key: string) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  return { sorted, sort, toggle };
}

/**
 * A sortable `<th>` — a button label with an ascending/descending/neutral
 * chevron and `aria-sort`. Matches the studio table header styling.
 */
export function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  numeric = false,
  className,
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  numeric?: boolean;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-3 font-medium", numeric && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground",
          numeric && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp aria-hidden className="size-3" />
          ) : (
            <ChevronDown aria-hidden className="size-3" />
          )
        ) : (
          <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
