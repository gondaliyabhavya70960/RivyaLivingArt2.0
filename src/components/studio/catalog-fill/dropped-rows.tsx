"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { TierFillDroppedRow } from "@/lib/import/tier-fill";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Rows a fill (preview or real) did not import, grouped by why. A tab-level
 * reason (missing fields on N rows) has no per-row identity — the count is
 * the whole story. A row-level reason (gift card, tombstoned, duplicate,
 * over cap) names the row, so the operator can look it up in the CSV.
 */
export function DroppedRows({ dropped }: { dropped: TierFillDroppedRow[] }) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const byReason = new Map<string, TierFillDroppedRow[]>();
    for (const row of dropped) {
      const list = byReason.get(row.reason) ?? [];
      list.push(row);
      byReason.set(row.reason, list);
    }
    return [...byReason.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [dropped]);

  if (dropped.length === 0) return null;

  return (
    <div className="rounded-card border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-start"
      >
        <span className="text-sm font-medium text-foreground">
          {dropped.length.toLocaleString("en-IN")}{" "}
          {dropped.length === 1 ? "row" : "rows"} not imported
        </span>
        {open ? (
          <ChevronUp aria-hidden className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4 pt-3">
          {grouped.map(([reason, rows]) => (
            <div key={reason}>
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Badge variant="outline">{rows.length}</Badge>
                {reason}
              </p>
              <ul
                className={cn(
                  "mt-1.5 max-h-40 space-y-1 overflow-y-auto ps-1 text-xs text-muted-foreground",
                )}
              >
                {rows.slice(0, 100).map((row, i) => (
                  <li key={`${row.tab}-${row.externalId ?? i}-${i}`}>
                    <span className="font-mono">{row.tab}</span>
                    {row.title && <> — {row.title}</>}
                    {row.sourceKey && (
                      <span className="text-graphite">
                        {" "}
                        ({row.sourceKey}
                        {row.externalId ? `|${row.externalId}` : ""})
                      </span>
                    )}
                  </li>
                ))}
                {rows.length > 100 && <li>… and {rows.length - 100} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
