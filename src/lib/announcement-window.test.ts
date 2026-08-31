import { describe, expect, it } from "vitest";

import { announcementIsLive } from "./announcement-window";

const at = (iso: string) => new Date(iso);

describe("announcementIsLive", () => {
  const now = at("2026-11-03T12:00:00Z");

  it("shows an announcement with no bounds at all", () => {
    // The behaviour before scheduling existed — a strip with neither bound
    // must keep working exactly as it always has.
    expect(announcementIsLive({}, now)).toBe(true);
    expect(announcementIsLive({ startsAt: null, endsAt: null }, now)).toBe(true);
  });

  it("holds one back until its start date", () => {
    expect(announcementIsLive({ startsAt: at("2026-11-04T00:00:00Z") }, now)).toBe(
      false,
    );
  });

  it("shows one once the start has passed", () => {
    expect(announcementIsLive({ startsAt: at("2026-11-01T00:00:00Z") }, now)).toBe(
      true,
    );
  });

  it("retires one after its end date", () => {
    expect(announcementIsLive({ endsAt: at("2026-11-02T00:00:00Z") }, now)).toBe(
      false,
    );
  });

  it("keeps showing one before its end date", () => {
    expect(announcementIsLive({ endsAt: at("2026-11-30T00:00:00Z") }, now)).toBe(
      true,
    );
  });

  it("respects both bounds together", () => {
    const window = {
      startsAt: at("2026-11-01T00:00:00Z"),
      endsAt: at("2026-11-30T00:00:00Z"),
    };
    expect(announcementIsLive(window, now)).toBe(true);
    expect(announcementIsLive(window, at("2026-10-31T00:00:00Z"))).toBe(false);
    expect(announcementIsLive(window, at("2026-12-01T00:00:00Z"))).toBe(false);
  });
});
