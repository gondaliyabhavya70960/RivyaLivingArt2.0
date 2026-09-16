import { describe, expect, it } from "vitest";

import {
  SHORTLIST_STATE_DESCRIPTIONS,
  SHORTLIST_STATE_LABELS,
  SHORTLIST_STATE_ORDER,
  SHORTLIST_TRANSITIONS,
  ShortlistState,
  canTransition,
  legacyReviewStatusFor,
  shortlistStateForLegacy,
} from "@/lib/scraper/shortlist";

const ALL_STATES = Object.values(ShortlistState);

describe("shortlist vocabulary", () => {
  it("covers every state with a label, a description and an order slot", () => {
    for (const state of ALL_STATES) {
      expect(SHORTLIST_STATE_LABELS[state]).toBeTruthy();
      expect(SHORTLIST_STATE_DESCRIPTIONS[state]).toBeTruthy();
      expect(SHORTLIST_STATE_ORDER).toContain(state);
      expect(SHORTLIST_TRANSITIONS[state]).toBeDefined();
    }
    expect(SHORTLIST_STATE_ORDER).toHaveLength(ALL_STATES.length);
  });
});

describe("the confirmation gate (rule 8)", () => {
  it("CONFIRMED is reachable only from SHORTLISTED", () => {
    const canConfirm = ALL_STATES.filter((state) =>
      canTransition(state, ShortlistState.CONFIRMED),
    );
    expect(canConfirm).toEqual([ShortlistState.SHORTLISTED]);
  });

  it("CONFIRMED leaves only back to SHORTLISTED — never to a parking lot", () => {
    expect(SHORTLIST_TRANSITIONS[ShortlistState.CONFIRMED]).toEqual([
      ShortlistState.SHORTLISTED,
    ]);
  });

  it("no state transitions into itself", () => {
    for (const state of ALL_STATES) {
      expect(canTransition(state, state)).toBe(false);
    }
  });

  it("no transition list is empty — every state can be revisited by a human", () => {
    for (const state of ALL_STATES) {
      expect(SHORTLIST_TRANSITIONS[state].length).toBeGreaterThan(0);
    }
  });

  it("parking lots can return to the funnel", () => {
    for (const parked of [
      ShortlistState.REJECTED,
      ShortlistState.INSPIRATION_ONLY,
      ShortlistState.DUPLICATE,
    ] as const) {
      expect(SHORTLIST_TRANSITIONS[parked]).toContain(ShortlistState.NEW);
    }
  });
});

describe("legacy reviewStatus mirror", () => {
  it("round-trips the states that have a legacy counterpart", () => {
    for (const state of [
      ShortlistState.NEW,
      ShortlistState.SHORTLISTED,
      ShortlistState.REJECTED,
    ] as const) {
      const legacy = legacyReviewStatusFor(state);
      expect(legacy).not.toBeNull();
      expect(shortlistStateForLegacy(legacy!)).toBe(state);
    }
  });

  it("maps CONFIRMED to null — confirming is not importing", () => {
    expect(legacyReviewStatusFor(ShortlistState.CONFIRMED)).toBeNull();
    expect(legacyReviewStatusFor(ShortlistState.REVIEW)).toBeNull();
    expect(legacyReviewStatusFor(ShortlistState.INSPIRATION_ONLY)).toBeNull();
    expect(legacyReviewStatusFor(ShortlistState.DUPLICATE)).toBeNull();
  });

  it("maps IMPORTED forward to CONFIRMED — the backfill's mapping", () => {
    expect(shortlistStateForLegacy("IMPORTED")).toBe(ShortlistState.CONFIRMED);
    expect(shortlistStateForLegacy("PENDING")).toBe(ShortlistState.NEW);
    expect(shortlistStateForLegacy("APPROVED")).toBe(
      ShortlistState.SHORTLISTED,
    );
    expect(shortlistStateForLegacy("REJECTED")).toBe(ShortlistState.REJECTED);
  });
});
