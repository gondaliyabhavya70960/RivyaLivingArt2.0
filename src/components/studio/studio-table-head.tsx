import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Header row for studio list tables. Centralises the column-label styling —
 * the arbitrary `text-12` uppercase treatment that was copy-pasted onto
 * ~18 `<tr>`s across the studio (DS-008).
 *
 * The cells wear `u-micro` — Part 3.2 puts every eyebrow and metadata line in
 * mono, and a column label is exactly that. Applied through a child selector
 * so ~18 call sites keep passing plain `<th>`s.
 *
 * Renders the `<tr>` only, so each table keeps its own `<thead>` (some are
 * plain, one is `sticky`). Pass the `<th>` cells as children; `className`
 * merges extra classes onto the row.
 */
export function StudioTableHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border [&>th]:u-micro [&>th]:whitespace-nowrap [&>th]:text-start [&>th]:font-normal",
        className,
      )}
    >
      {children}
    </tr>
  );
}
