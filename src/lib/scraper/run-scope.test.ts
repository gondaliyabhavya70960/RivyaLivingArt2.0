import { describe, expect, it } from "vitest";

import {
  IN_FLIGHT_STATUSES,
  isStaleRunning,
  partitionByInFlight,
} from "@/lib/scraper/run-scope";

const SOURCES = [
  { id: "s1", name: "Supplier A" },
  { id: "s2", name: "Supplier B" },
  { id: "s3", name: "Supplier C" },
];

const NOW = new Date("2026-09-03T12:00:00Z");
const job = (sourceId: string | null, status: string, minutesAgo = 0) => ({
  sourceId,
  status,
  updatedAt: new Date(NOW.getTime() - minutesAgo * 60_000),
});

describe("partitionByInFlight", () => {
  it("queues everything when nothing is running", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, []);
    expect(queueable).toHaveLength(3);
    expect(skipped).toEqual([]);
  });

  it("skips a source that already has a job in flight", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, [
      job("s2", "RUNNING"),
    ]);
    expect(queueable.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(skipped).toEqual(["Supplier B"]);
  });

  it("queues nothing when every source is busy", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, [
      job("s1", "QUEUED"),
      job("s2", "RUNNING"),
      job("s3", "QUEUED"),
    ]);
    expect(queueable).toEqual([]);
    expect(skipped).toEqual(["Supplier A", "Supplier B", "Supplier C"]);
  });

  it("reports skips by name, because a cuid is not actionable", () => {
    const { skipped } = partitionByInFlight(SOURCES, [job("s3", "RUNNING")]);
    expect(skipped).toEqual(["Supplier C"]);
  });

  it("ignores null sourceIds — a job whose source row was deleted", () => {
    // ScrapeJob.sourceId is nullable (onDelete: SetNull), so the in-flight
    // query can legitimately return nulls. They must not match anything.
    const { queueable, skipped } = partitionByInFlight(SOURCES, [
      job(null, "RUNNING"),
      job("s1", "QUEUED"),
    ]);
    expect(skipped).toEqual(["Supplier A"]);
    expect(queueable.map((s) => s.id)).toEqual(["s2", "s3"]);
  });

  it("is unaffected by a busy id that is not in this batch", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, [
      job("s99", "RUNNING"),
    ]);
    expect(queueable).toHaveLength(3);
    expect(skipped).toEqual([]);
  });

  it("treats QUEUED as in-flight, not just RUNNING", () => {
    // A queued job has not started, so starting another is the same duplicate
    // a moment earlier. This asserts the contract the DB query relies on.
    expect(IN_FLIGHT_STATUSES).toContain("QUEUED");
    expect(IN_FLIGHT_STATUSES).toContain("RUNNING");
    expect(IN_FLIGHT_STATUSES).not.toContain("DONE");
    expect(IN_FLIGHT_STATUSES).not.toContain("FAILED");
  });

  describe("staleBefore", () => {
    it("without it, an old RUNNING job still blocks (today's behaviour)", () => {
      const { skipped } = partitionByInFlight(SOURCES, [
        job("s1", "RUNNING", 60),
      ]);
      expect(skipped).toEqual(["Supplier A"]);
    });

    it("a RUNNING job older than the cutoff no longer blocks", () => {
      const staleBefore = new Date(NOW.getTime() - 10 * 60_000);
      const { queueable, skipped } = partitionByInFlight(
        SOURCES,
        [job("s1", "RUNNING", 60)],
        { staleBefore },
      );
      expect(skipped).toEqual([]);
      expect(queueable.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    });

    it("a RUNNING job newer than the cutoff still blocks", () => {
      const staleBefore = new Date(NOW.getTime() - 10 * 60_000);
      const { skipped } = partitionByInFlight(
        SOURCES,
        [job("s1", "RUNNING", 2)],
        { staleBefore },
      );
      expect(skipped).toEqual(["Supplier A"]);
    });

    it("QUEUED never goes stale, no matter how old", () => {
      const staleBefore = new Date(NOW.getTime() - 10 * 60_000);
      const { skipped } = partitionByInFlight(
        SOURCES,
        [job("s1", "QUEUED", 24 * 60)],
        { staleBefore },
      );
      expect(skipped).toEqual(["Supplier A"]);
    });
  });
});

describe("isStaleRunning", () => {
  it("is false when no cutoff is given", () => {
    expect(isStaleRunning(job("s1", "RUNNING", 999), undefined)).toBe(false);
  });

  it("is false for QUEUED even past the cutoff", () => {
    const staleBefore = new Date(NOW.getTime() - 10 * 60_000);
    expect(isStaleRunning(job("s1", "QUEUED", 999), staleBefore)).toBe(false);
  });

  it("is true for RUNNING past the cutoff", () => {
    const staleBefore = new Date(NOW.getTime() - 10 * 60_000);
    expect(isStaleRunning(job("s1", "RUNNING", 11), staleBefore)).toBe(true);
  });

  it("is false for RUNNING within the cutoff", () => {
    const staleBefore = new Date(NOW.getTime() - 10 * 60_000);
    expect(isStaleRunning(job("s1", "RUNNING", 9), staleBefore)).toBe(false);
  });
});
