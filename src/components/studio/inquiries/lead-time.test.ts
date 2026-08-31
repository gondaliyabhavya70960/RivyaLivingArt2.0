import { describe, expect, it } from "vitest";

import {
  priorityFromBand,
  stageTimer,
  SMALL_PIECE_DAYS,
  STATEMENT_PIECE_DAYS,
} from "@/components/studio/inquiries/lead-time";

/**
 * The commission board's stage-timer ring is the one place in the Studio where
 * a number is COMPUTED rather than read from a column, so the maths that turns
 * `createdAt` into a lead-time band is worth pinning down: the published bands
 * (7–10 days / 3–6 weeks) are business facts, and a boundary that drifts would
 * silently mislabel a commission as overdue.
 *
 * `stageTimer` takes `now` so none of this is clock-dependent.
 */
const NOW = Date.UTC(2026, 7, 22, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000);

describe("stageTimer", () => {
  it("counts whole days in the pipeline", () => {
    expect(stageTimer(daysAgo(0), NOW).days).toBe(0);
    expect(stageTimer(daysAgo(1), NOW).days).toBe(1);
    expect(stageTimer(daysAgo(37), NOW).days).toBe(37);
  });

  it("never reports negative days for a future timestamp", () => {
    expect(stageTimer(new Date(NOW + 60_000), NOW).days).toBe(0);
  });

  it("stays inside the small-piece band up to and including day 10", () => {
    expect(stageTimer(daysAgo(SMALL_PIECE_DAYS), NOW).band).toBe("within");
    expect(stageTimer(daysAgo(SMALL_PIECE_DAYS + 1), NOW).band).toBe(
      "beyond-small",
    );
  });

  it("stays inside the statement-piece band up to and including day 42", () => {
    expect(stageTimer(daysAgo(STATEMENT_PIECE_DAYS), NOW).band).toBe(
      "beyond-small",
    );
    expect(stageTimer(daysAgo(STATEMENT_PIECE_DAYS + 1), NOW).band).toBe(
      "beyond-statement",
    );
  });

  it("clamps ring progress to the statement-piece ceiling", () => {
    expect(stageTimer(daysAgo(0), NOW).progress).toBe(0);
    expect(stageTimer(daysAgo(21), NOW).progress).toBeCloseTo(0.5, 2);
    expect(stageTimer(daysAgo(400), NOW).progress).toBe(1);
  });

  it("describes the band in words, singular on day one", () => {
    expect(stageTimer(daysAgo(1), NOW).description).toContain("1 day in");
    expect(stageTimer(daysAgo(2), NOW).description).toContain("2 days in");
    expect(stageTimer(daysAgo(50), NOW).description).toContain("3–6 week");
  });
});

describe("priorityFromBand", () => {
  it("derives priority from the band, never from a stored field", () => {
    expect(priorityFromBand("within")).toEqual({
      label: "On track",
      tone: "flat",
    });
    expect(priorityFromBand("beyond-small")).toEqual({
      label: "Running long",
      tone: "warning",
    });
    expect(priorityFromBand("beyond-statement")).toEqual({
      label: "Overdue",
      tone: "alert",
    });
  });
});
