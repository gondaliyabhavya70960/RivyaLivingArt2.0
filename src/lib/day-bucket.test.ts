import { describe, expect, it } from "vitest";

import {
  asChartTimezone,
  bucketNote,
  dayKey,
  startOfToday,
} from "@/lib/day-bucket";

describe("day bucketing", () => {
  // 22:00 UTC = 03:30 IST next day — the exact case the owner decision was
  // about: a late-evening India order landing in "tomorrow's" bucket.
  const lateEvening = new Date("2026-08-22T22:00:00.000Z");

  it("keys UTC days by the UTC calendar", () => {
    expect(dayKey(lateEvening, "UTC")).toBe("2026-08-22");
  });

  it("keys IST days across the +05:30 midnight boundary", () => {
    expect(dayKey(lateEvening, "IST")).toBe("2026-08-23");
  });

  it("agrees between zones away from the boundary", () => {
    const noon = new Date("2026-08-22T12:00:00.000Z");
    expect(dayKey(noon, "UTC")).toBe(dayKey(noon, "IST"));
  });

  it("startOfToday(UTC) is UTC midnight", () => {
    const start = startOfToday("UTC", lateEvening.getTime());
    expect(start.toISOString()).toBe("2026-08-22T00:00:00.000Z");
  });

  it("startOfToday(IST) is 18:30 UTC of the previous UTC day", () => {
    const start = startOfToday("IST", lateEvening.getTime());
    // 22:00Z is already Aug 23 in IST; IST midnight Aug 23 = Aug 22 18:30Z.
    expect(start.toISOString()).toBe("2026-08-22T18:30:00.000Z");
  });

  it("narrows stored strings safely", () => {
    expect(asChartTimezone("IST")).toBe("IST");
    expect(asChartTimezone("UTC")).toBe("UTC");
    expect(asChartTimezone("Asia/Kolkata")).toBe("UTC");
    expect(asChartTimezone(null)).toBe("UTC");
  });

  it("captions match the zone", () => {
    expect(bucketNote("IST")).toBe("IST day buckets");
    expect(bucketNote("UTC")).toBe("UTC day buckets");
  });
});
