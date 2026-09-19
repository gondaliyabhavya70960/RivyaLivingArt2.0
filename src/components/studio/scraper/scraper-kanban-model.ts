import type { IconName } from "@/components/icons";
import type { KanbanMoveOption } from "@/components/studio/kanban";
import {
  SHORTLIST_STATE_LABELS,
  SHORTLIST_STATE_ORDER,
  SHORTLIST_TRANSITIONS,
  ShortlistState,
} from "@/lib/scraper/shortlist";

/**
 * The scraper Kanban's pure model — lanes, per-card move options, and what a
 * move result says. The state machine (`SHORTLIST_TRANSITIONS`) is imported,
 * never re-declared: CONFIRMED appears among a card's options ONLY from
 * SHORTLISTED, because that is the gate, and the gate lives in one file.
 */

/** Lane order is the funnel first, then the parking lots — the inbox's own order. */
export const SCRAPER_KANBAN_LANES = SHORTLIST_STATE_ORDER;

/**
 * Lane marks, exhaustive by type: a new ShortlistState in the schema stops
 * this file compiling until it has a mark (the registry's mechanism, applied
 * locally — the funnel's states are used by these screens alone; if a second
 * consumer appears, promote this to `components/icons/status.ts`).
 */
export const SHORTLIST_LANE_ICON: Record<ShortlistState, IconName> = {
  NEW: "status-new",
  REVIEW: "status-review",
  SHORTLISTED: "status-quoted",
  CONFIRMED: "status-confirmed",
  INSPIRATION_ONLY: "media-image",
  DUPLICATE: "status-archived",
  REJECTED: "status-declined",
};

/**
 * What a card may do: its current state plus the transitions the state
 * machine allows FROM it — nothing more. A REVIEW card never sees Confirmed;
 * a SHORTLISTED card sees it first (it is the move the funnel exists for);
 * a CONFIRMED card can only go back to Shortlisted (an un-confirm is a human
 * reconsidering, never a silent demotion).
 */
export function scraperMoveOptions(
  state: ShortlistState,
): KanbanMoveOption<ShortlistState>[] {
  return [state, ...SHORTLIST_TRANSITIONS[state]].map((value) => ({
    value,
    label: SHORTLIST_STATE_LABELS[value],
  }));
}

/** The counts a `setShortlistState` call returns. */
export type ScraperMoveReport = {
  moved: number;
  already: number;
  blocked: number;
};

/**
 * The move toast — mirrors the inbox's `reportToast`, including the
 * CONFIRMED-specific refusal (only shortlisted items can be confirmed), so
 * a card moved from either view reads the same.
 */
export function describeScraperMoveToast(
  target: ShortlistState,
  report: ScraperMoveReport,
): string {
  const parts = [
    `${report.moved} ${target === ShortlistState.CONFIRMED ? "confirmed" : "moved"}`,
  ];
  if (report.already > 0) parts.push(`${report.already} already there`);
  if (report.blocked > 0) {
    parts.push(
      target === ShortlistState.CONFIRMED
        ? `${report.blocked} skipped — only shortlisted items can be confirmed`
        : `${report.blocked} skipped — that move is not allowed from their state`,
    );
  }
  return parts.join(" · ");
}
