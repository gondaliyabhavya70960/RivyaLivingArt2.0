"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateStagedProduct } from "@/actions/scraper-review";
import {
  setShortlistNote,
  setShortlistState,
  setShortlistTags,
} from "@/actions/scraper-shortlist";
import {
  KanbanBoard,
  KanbanCardShell,
  KanbanColumn,
  KanbanMoveSelect,
} from "@/components/studio/kanban";
import {
  SCRAPER_KANBAN_LANES,
  SHORTLIST_LANE_ICON,
  describeScraperMoveToast,
  scraperMoveOptions,
} from "@/components/studio/scraper/scraper-kanban-model";
import { DetailSheetBody } from "@/components/studio/scraper/shortlist-detail-sheet";
import {
  StateBadge,
  formatPriceRange,
} from "@/components/studio/scraper/shortlist-shared";
import {
  SHORTLIST_STATE_LABELS,
  ShortlistState,
} from "@/lib/scraper/shortlist";
import type { InboxCounts, InboxRow } from "@/lib/scraper/shortlist-query";
import {
  SIZE_TIER_NUMBER,
  SIZE_TIER_SHORT,
  sizeTierStudioLabel,
} from "@/lib/product-size-tier";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";

/**
 * The scraper review board — KANBAN-SPEC Board 3.
 *
 * Column view over the shortlist funnel: the four funnel states first, then
 * the parking lots, in the inbox's own order. The grid stays as the screen's
 * Table view (it owns the bulk system); the board is the visual funnel read
 * plus the one-card move.
 *
 * **The state machine is the menu.** Each card's move select offers its
 * current state plus exactly the transitions `SHORTLIST_TRANSITIONS` allows
 * — so CONFIRMED appears only on SHORTLISTED cards (the gate), and a
 * CONFIRMED card can only go back to Shortlisted. Moves call the same
 * `setShortlistState` the inbox uses; the toast mirrors its wording, so a
 * card moved from either view reads the same.
 *
 * **One drawer.** The title opens the SAME detail sheet the grid opens
 * (extracted in this PR — `shortlist-detail-sheet.tsx`), so the funnel move
 * with reason, edit-before-import, note and tags never drift between views.
 */
export function ScraperKanban({
  rows,
  counts,
  truncated,
  totalMatching,
}: {
  /** All-state rows for the lanes (the grid keeps its per-state slice). */
  rows: InboxRow[];
  counts: InboxCounts;
  truncated: boolean;
  totalMatching: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxRow | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  const move = (card: InboxRow, next: ShortlistState) => {
    if (next === card.state) return;
    setBusyId(card.researchProductId);
    startTransition(async () => {
      const result = await setShortlistState([card.researchProductId], next);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        toast.success(
          describeScraperMoveToast(next, {
            moved: result.data.moved,
            already: result.data.already,
            blocked: result.data.blocked.length,
          }),
        );
      }
      router.refresh();
    });
  };

  // The drawer's handlers — the same four actions, with the same toasts as
  // the inbox's, so a row edited or moved from either view behaves alike.
  async function handleTransition(target: ShortlistState, reason: string) {
    if (!detail) return;
    setSheetBusy(true);
    const res = await setShortlistState([detail.researchProductId], target, reason);
    setSheetBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) {
      toast.success(
        describeScraperMoveToast(target, {
          moved: res.data.moved,
          already: res.data.already,
          blocked: res.data.blocked.length,
        }),
      );
    }
    setDetail(null);
    router.refresh();
  }

  async function handleSaveEdit(patch: {
    id: string;
    title: string;
    shortTagline: string | null;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
  }) {
    const res = await updateStagedProduct(patch);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved.");
    setDetail((d) =>
      d && d.twinId === patch.id
        ? {
            ...d,
            title: patch.title,
            shortTagline: patch.shortTagline,
            category: patch.category,
            priceMin: patch.priceMin,
            priceMax: patch.priceMax,
          }
        : d,
    );
    router.refresh();
  }

  async function handleSaveNote(note: string | null) {
    if (!detail) return;
    const res = await setShortlistNote(detail.researchProductId, note);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Note saved.");
    setDetail((d) => (d ? { ...d, note } : d));
    router.refresh();
  }

  async function handleSaveTags(tags: string[]) {
    if (!detail) return;
    const res = await setShortlistTags(detail.researchProductId, tags);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Tags saved.");
    setDetail((d) => (d ? { ...d, tags } : d));
    router.refresh();
  }

  return (
    <div>
      {truncated && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing the {rows.length} most recently seen of {totalMatching}{" "}
          matching items — narrow the filters to see the rest.
        </p>
      )}
      <KanbanBoard>
        {SCRAPER_KANBAN_LANES.map((state) => {
          const lane = rows.filter((row) => row.state === state);
          return (
            <KanbanColumn
              key={state}
              icon={
                <Icon
                  name={SHORTLIST_LANE_ICON[state]}
                  size={16}
                  className="translate-y-px text-graphite"
                />
              }
              label={SHORTLIST_STATE_LABELS[state]}
              count={counts[state] ?? 0}
              empty={lane.length === 0}
            >
              {lane.map((card) => (
                <li key={card.researchProductId}>
                  <ScraperKanbanCard
                    card={card}
                    busy={pending && busyId === card.researchProductId}
                    onMove={(next) => move(card, next)}
                    onOpen={() => setDetail(card)}
                  />
                </li>
              ))}
            </KanbanColumn>
          );
        })}
      </KanbanBoard>

      <Sheet
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        {detail && (
          <DetailSheetBody
            key={detail.researchProductId}
            row={detail}
            busy={sheetBusy}
            onTransition={handleTransition}
            onSave={handleSaveEdit}
            onSaveNote={handleSaveNote}
            onSaveTags={handleSaveTags}
          />
        )}
      </Sheet>
    </div>
  );
}

function ScraperKanbanCard({
  card,
  busy,
  onMove,
  onOpen,
}: {
  card: InboxRow;
  busy: boolean;
  onMove: (next: ShortlistState) => void;
  onOpen: () => void;
}) {
  return (
    <KanbanCardShell busy={busy}>
      <div className="flex items-start gap-3">
        {card.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- scraped images live on arbitrary hosts; never next/image
          <img
            src={card.images[0]}
            alt={card.imageAlts[0] ?? card.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="size-12 shrink-0 rounded-image border border-border bg-muted object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="size-12 shrink-0 rounded-image border border-border bg-muted"
          />
        )}

        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-small font-medium text-foreground">
            <button
              type="button"
              onClick={onOpen}
              title={card.title}
              className="rounded-input text-left underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              {card.title}
            </button>
          </h4>
          <p className="text-small tabular-nums text-graphite">
            {formatPriceRange(card.priceMin, card.priceMax)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" title="Source website">
          {card.sourceName}
        </Badge>
        {card.suggestedSizeTier && (
          <Badge
            variant="outline"
            title={`Suggested tier: ${sizeTierStudioLabel(card.suggestedSizeTier)}`}
          >
            Tier {SIZE_TIER_NUMBER[card.suggestedSizeTier]} ·{" "}
            {SIZE_TIER_SHORT[card.suggestedSizeTier]}
          </Badge>
        )}
        <Badge variant={card.updated ? "outline" : "secondary"}>
          {card.updated ? "updated" : "new"}
        </Badge>
        <StateBadge state={card.state} />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <KanbanMoveSelect
          value={card.state}
          options={scraperMoveOptions(card.state)}
          disabled={busy}
          onMove={onMove}
          ariaLabel={`Funnel state for ${card.title}`}
        />
      </div>
    </KanbanCardShell>
  );
}
