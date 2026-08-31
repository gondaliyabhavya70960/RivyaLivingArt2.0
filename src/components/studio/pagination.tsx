"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Studio-wide default page size. */
export const PAGE_SIZE = 50;

/**
 * Client-side pagination for studio list tables. Slices `rows` into pages of
 * `pageSize`. `resetKey` (e.g. the active filter/search string) snaps back to
 * page 1 whenever it changes, and the current page is clamped when the row set
 * shrinks (a filter, a delete) so you never land on an empty page.
 */
export function usePagination<T>(
  rows: T[],
  pageSize: number = PAGE_SIZE,
  resetKey?: unknown,
) {
  const [page, setPage] = useState(1);

  // Snap to page 1 when the filter/search key changes — the render-time
  // "reset state on prop change" pattern (no effect, so no cascading render).
  const [prevKey, setPrevKey] = useState<unknown>(resetKey);
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamp is derived (not synced to state) so an out-of-range page from a
  // shrunk row set never lands you on an empty page.
  const current = Math.min(page, pageCount);

  const pageRows = useMemo(
    () => rows.slice((current - 1) * pageSize, current * pageSize),
    [rows, current, pageSize],
  );

  return { pageRows, page: current, setPage, pageCount, total: rows.length, pageSize };
}

/**
 * Pagination control — "N–M of T" plus Prev / Page x/y / Next. Renders nothing
 * for an empty set; shows the count line but hides the buttons for a single
 * page.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
  unit = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  unit?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div
      className={cn(
        "mt-5 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <span className="u-micro">
        {from}–{to} of {total} {unit}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft strokeWidth={1.5} /> Prev
          </Button>
          <span className="u-num text-small text-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next <ChevronRight strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
}
