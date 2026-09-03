import { describe, expect, it } from "vitest";

import {
  BREAKER_THRESHOLD,
  describeBlockedRun,
  describeBreakerSkip,
  describeTrip,
  nextFailureCount,
  resolveDelayMs,
  shouldTrip,
} from "@/lib/scraper/breaker";

describe("nextFailureCount", () => {
  it("counts up on failure", () => {
    expect(nextFailureCount(0, "FAILED")).toBe(1);
    expect(nextFailureCount(4, "FAILED")).toBe(5);
  });

  it("resets to zero on success, rather than decaying", () => {
    // A source that fails, succeeds, then fails is having a bad day, not
    // blocking us. A decaying counter would creep up on those and eventually
    // pause a source that works.
    expect(nextFailureCount(4, "DONE")).toBe(0);
  });
});

describe("shouldTrip", () => {
  it("does not trip below the threshold", () => {
    expect(shouldTrip(BREAKER_THRESHOLD - 1)).toBe(false);
  });

  it("trips at the threshold", () => {
    expect(shouldTrip(BREAKER_THRESHOLD)).toBe(true);
  });

  it("stays tripped above it", () => {
    expect(shouldTrip(BREAKER_THRESHOLD + 10)).toBe(true);
  });

  it("honours a custom threshold", () => {
    expect(shouldTrip(2, 3)).toBe(false);
    expect(shouldTrip(3, 3)).toBe(true);
  });
});

describe("describeBlockedRun", () => {
  it("allows a source that is not paused", () => {
    expect(
      describeBlockedRun("Supplier A", { pausedAt: null, pausedReason: null }),
    ).toBeNull();
  });

  it("blocks a paused source with its recorded reason", () => {
    const reason = describeTrip("Supplier A", 5);
    expect(
      describeBlockedRun("Supplier A", {
        pausedAt: new Date(),
        pausedReason: reason,
      }),
    ).toBe(reason);
  });

  it("still explains itself when the reason was lost", () => {
    const msg = describeBlockedRun("Supplier A", {
      pausedAt: new Date(),
      pausedReason: null,
    });
    expect(msg).toContain("Supplier A");
    expect(msg).toMatch(/paused/i);
  });
});

describe("resolveDelayMs", () => {
  it("uses the shared default when the source sets nothing", () => {
    expect(resolveDelayMs(null, 700)).toBe(700);
    expect(resolveDelayMs(undefined, 700)).toBe(700);
  });

  it("uses a slower per-source delay", () => {
    expect(resolveDelayMs(2000, 700)).toBe(2000);
  });

  it("never goes faster than the shared floor", () => {
    // The knob exists to slow down for a site that rate-limits us, not to
    // speed past our own politeness floor.
    expect(resolveDelayMs(50, 700)).toBe(700);
    expect(resolveDelayMs(0, 700)).toBe(700);
  });

  it("caps an absurd value rather than stalling a job for an hour", () => {
    expect(resolveDelayMs(5_000_000, 700)).toBe(60_000);
  });

  it("ignores a non-finite value", () => {
    expect(resolveDelayMs(Number.NaN, 700)).toBe(700);
  });
});

describe("describeBreakerSkip", () => {
  it("names the missing source's key", () => {
    expect(describeBreakerSkip("some-resin-store")).toContain(
      "some-resin-store",
    );
  });

  it("reads as a log line, not an error", () => {
    expect(describeBreakerSkip("x").toLowerCase()).toContain("skipping");
  });
});
