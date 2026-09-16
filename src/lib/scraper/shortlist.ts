/**
 * The shortlist funnel — the vocabulary of "human confirmation gates the
 * final list" (B7, plan §4 phase 6c + rule 8).
 *
 * A researched product starts at NEW — implicitly, with no row at all: an
 * entry is created the first time a human touches it, so the table records
 * decisions, not arrivals. The funnel runs NEW → REVIEW → SHORTLISTED →
 * CONFIRMED, with REJECTED, INSPIRATION_ONLY and DUPLICATE as parking lots a
 * human can always pull a product back out of.
 *
 * Two rules are structural, not conventional:
 *
 * 1. CONFIRMED is reachable only from SHORTLISTED. Nothing skips the
 *    shortlist — not a bulk action, not the import path, not a scrape.
 * 2. Nothing auto-confirms. The only callers of the write path are Studio
 *    actions behind `requireStaff`; a scrape job can change what a product
 *    IS (new snapshot) but never where it STANDS.
 *
 * Pure module: no db, no fetch — importable from client components and unit
 * tests. The write path lives in `shortlist-write.ts` (server-only).
 */
import { ShortlistState } from "@/generated/prisma/enums";
import type { ReviewStatus } from "@/generated/prisma/enums";

export { ShortlistState };

/** Display order — the funnel first, then the parking lots. */
export const SHORTLIST_STATE_ORDER: ShortlistState[] = [
  ShortlistState.NEW,
  ShortlistState.REVIEW,
  ShortlistState.SHORTLISTED,
  ShortlistState.CONFIRMED,
  ShortlistState.INSPIRATION_ONLY,
  ShortlistState.DUPLICATE,
  ShortlistState.REJECTED,
];

export const SHORTLIST_STATE_LABELS: Record<ShortlistState, string> = {
  NEW: "New",
  REVIEW: "In review",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  CONFIRMED: "Confirmed",
  INSPIRATION_ONLY: "Inspiration only",
  DUPLICATE: "Duplicate",
};

/** One line each, shown under the state select so a move is never a mystery. */
export const SHORTLIST_STATE_DESCRIPTIONS: Record<ShortlistState, string> = {
  NEW: "Seen by the scraper, not yet triaged by a human.",
  REVIEW: "Someone is actively looking at this one.",
  SHORTLISTED:
    "Worth benchmarking against — feeds the comparison scopes, and is the only state that can be confirmed.",
  REJECTED: "Considered and set aside. Can be pulled back to New anytime.",
  CONFIRMED:
    "The gated final list — the only state the CSV/XLSX export reads. Reachable only from Shortlisted, only by hand.",
  INSPIRATION_ONLY:
    "Kept as a reference-board image — shape, colour, technique. Never a benchmark row, never exported.",
  DUPLICATE:
    "The same product seen under another source or listing. Kept for provenance, out of every count.",
};

/**
 * The allowed moves. Every entry is a deliberate human decision; there are
 * no automatic transitions anywhere in the codebase, so this map IS the
 * state machine.
 *
 * The asymmetries are the rules:
 * - CONFIRMED appears only under SHORTLISTED (the gate).
 * - CONFIRMED can leave only back to SHORTLISTED — an un-confirm is a human
 *   reconsidering, but a confirmed product is never silently demoted to a
 *   parking lot; the export may already have gone out.
 * - REJECTED / INSPIRATION_ONLY / DUPLICATE can return to the funnel,
 *   because a parking decision is the lightest one a reviewer makes.
 */
export const SHORTLIST_TRANSITIONS: Readonly<
  Record<ShortlistState, readonly ShortlistState[]>
> = {
  NEW: [
    ShortlistState.REVIEW,
    ShortlistState.SHORTLISTED,
    ShortlistState.INSPIRATION_ONLY,
    ShortlistState.DUPLICATE,
    ShortlistState.REJECTED,
  ],
  REVIEW: [
    ShortlistState.SHORTLISTED,
    ShortlistState.INSPIRATION_ONLY,
    ShortlistState.DUPLICATE,
    ShortlistState.REJECTED,
    ShortlistState.NEW,
  ],
  SHORTLISTED: [
    ShortlistState.CONFIRMED,
    ShortlistState.REVIEW,
    ShortlistState.INSPIRATION_ONLY,
    ShortlistState.DUPLICATE,
    ShortlistState.REJECTED,
  ],
  CONFIRMED: [ShortlistState.SHORTLISTED],
  INSPIRATION_ONLY: [
    ShortlistState.NEW,
    ShortlistState.SHORTLISTED,
    ShortlistState.REJECTED,
  ],
  DUPLICATE: [ShortlistState.NEW, ShortlistState.REJECTED],
  REJECTED: [ShortlistState.NEW, ShortlistState.REVIEW],
};

/**
 * Whether moving an entry from `from` to `to` is allowed. Same-state moves
 * are not transitions and return false — the write path treats them as
 * no-ops before ever asking this.
 */
export function canTransition(
  from: ShortlistState,
  to: ShortlistState,
): boolean {
  return SHORTLIST_TRANSITIONS[from].includes(to);
}

/**
 * The legacy `ScrapedProduct.reviewStatus` a state mirrors to, or null when
 * the state has no legacy counterpart. The mirror keeps the old promote path
 * (which still reads APPROVED) working while the inbox lives on entries:
 * SHORTLISTED → APPROVED is what lets the import dialog find the row.
 *
 * CONFIRMED deliberately maps to null: confirming is not importing, and
 * IMPORTED is only ever written by the import path itself.
 */
export function legacyReviewStatusFor(
  state: ShortlistState,
): ReviewStatus | null {
  switch (state) {
    case ShortlistState.NEW:
      return "PENDING";
    case ShortlistState.SHORTLISTED:
      return "APPROVED";
    case ShortlistState.REJECTED:
      return "REJECTED";
    default:
      return null;
  }
}

/**
 * The entry state a legacy reviewStatus mirrors to (the backfill's mapping,
 * reused at write time so the two directions can never drift apart):
 * PENDING→NEW, APPROVED→SHORTLISTED, REJECTED→REJECTED, IMPORTED→CONFIRMED.
 */
export function shortlistStateForLegacy(
  status: ReviewStatus,
): ShortlistState {
  switch (status) {
    case "APPROVED":
      return ShortlistState.SHORTLISTED;
    case "REJECTED":
      return ShortlistState.REJECTED;
    case "IMPORTED":
      return ShortlistState.CONFIRMED;
    default:
      return ShortlistState.NEW;
  }
}
