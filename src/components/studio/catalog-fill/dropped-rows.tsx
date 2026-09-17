"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type {
  TierFillDroppedCounts,
  TierFillDroppedRow,
} from "@/lib/import/tier-fill";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Rows a fill (preview or real) did not import, grouped by why. A tab-level
 * reason (missing fields on N rows) has no per-row identity — the count is
 * the whole story. A row-level reason (gift card, tombstoned, duplicate,
 * over cap) names the row, so the operator can look it up in the CSV.
 *
 * `dropped` carries EXAMPLES, up to a hundred per reason
 * (`summarizeDropped`) — a full run drops tens of thousands of rows and this
 * list never showed more than a hundred of them anyway. `byReason` and
 * `total` are the exact numbers; without them (an older stored run) the
 * examples are all there is, and the counts come from those.
 */
export function DroppedRows({
  dropped,
  byReason,
  total,
}: {
  dropped: TierFillDroppedRow[];
  byReason?: TierFillDroppedCounts;
  total?: number;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const samples = new Map<string, TierFillDroppedRow[]>();
    for (const row of dropped) {
      const list = samples.get(row.reason) ?? [];
      list.push(row);
      samples.set(row.reason, list);
    }
    const reasons = new Set([...samples.keys(), ...Object.keys(byReason ?? {})]);
    return [...reasons]
      .map(
        (reason) =>
          [
            reason,
            samples.get(reason) ?? [],
            byReason?.[reason] ?? samples.get(reason)?.length ?? 0,
          ] as const,
      )
      .sort((a, b) => b[2] - a[2]);
  }, [dropped, byReason]);

  const shown = total ?? dropped.length;
  if (shown === 0) return null;

  return (
    <div className="rounded-card border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-start"
      >
        <span className="text-sm font-medium text-foreground">
          {shown.toLocaleString("en-IN")} {shown === 1 ? "row" : "rows"} not
          imported
        </span>
        {open ? (
          <ChevronUp aria-hidden className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4 pt-3">
          {grouped.map(([reason, rows, count]) => (
            <div key={reason}>
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Badge variant="outline">
                  {count.toLocaleString("en-IN")}
                </Badge>
                {reason}
              </p>
              <ul
                className={cn(
                  "mt-1.5 max-h-40 space-y-1 overflow-y-auto ps-1 text-xs text-muted-foreground",
                )}
              >
                {rows.map((row, i) => (
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
                {count > rows.length && (
                  <li>… and {(count - rows.length).toLocaleString("en-IN")} more</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
