"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  resolveKanbanView,
  useStoredView,
} from "@/components/studio/kanban";
import { ScraperKanban } from "@/components/studio/scraper/scraper-kanban";
import { ShortlistInbox } from "@/components/studio/scraper/shortlist-inbox";
import type { ScrapeTier } from "@/generated/prisma/enums";
import type { ShortlistState } from "@/lib/scraper/shortlist";
import type { InboxCounts, InboxRow } from "@/lib/scraper/shortlist-query";

/**
 * The review screen's Table | Board switch. The grid (ShortlistInbox — the
 * bulk system, the per-state slice) stays the Table view and the default;
 * the board (ScraperKanban) is the funnel read over ALL states. Resolution
 * is the shared rule: `?view=kanban` wins when present, the per-device
 * preference otherwise, and toggling writes both so a refresh, a shared
 * link and the next visit land on the same view.
 */
export function ShortlistView({
  rows,
  boardRows,
  boardTruncated,
  boardTotalMatching,
  sources,
  categories,
  counts,
  activeSource,
  activeSourceTier,
  activeSizeTier,
  activeState,
  initialQuery,
  truncated,
  totalMatching,
}: {
  /** The grid's per-state slice (unchanged from the inbox's own contract). */
  rows: InboxRow[];
  /** The board's all-state rows — the funnel needs every lane fed. */
  boardRows: InboxRow[];
  boardTruncated: boolean;
  boardTotalMatching: number;
  sources: { key: string; name: string; tier: ScrapeTier }[];
  categories: { id: string; name: string }[];
  counts: InboxCounts;
  activeSource: string;
  activeSourceTier: string;
  activeSizeTier: string;
  activeState: ShortlistState | "ALL";
  initialQuery: string;
  truncated: boolean;
  totalMatching: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [storedView, setStoredView] = useStoredView("rr-studio-scraper-view");
  const view = resolveKanbanView(searchParams.get("view"), storedView);
  const setView = (next: "table" | "kanban") => {
    setStoredView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "kanban") params.set("view", "kanban");
    else params.delete("view");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <div
          role="group"
          aria-label="View"
          className="flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1"
        >
          {(
            [
              { value: "table", label: "Grid" },
              { value: "kanban", label: "Board" },
            ] as const
          ).map((option) => {
            const active = view === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setView(option.value)}
                className={
                  active
                    ? "inline-flex min-h-11 items-center rounded-full bg-foreground/6 px-5 text-small font-medium text-foreground"
                    : "inline-flex min-h-11 items-center rounded-full px-5 text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "kanban" ? (
        <ScraperKanban
          rows={boardRows}
          counts={counts}
          truncated={boardTruncated}
          totalMatching={boardTotalMatching}
        />
      ) : (
        <ShortlistInbox
          rows={rows}
          sources={sources}
          categories={categories}
          counts={counts}
          activeSource={activeSource}
          activeSourceTier={activeSourceTier}
          activeSizeTier={activeSizeTier}
          activeState={activeState}
          initialQuery={initialQuery}
          truncated={truncated}
          totalMatching={totalMatching}
        />
      )}
    </div>
  );
}
