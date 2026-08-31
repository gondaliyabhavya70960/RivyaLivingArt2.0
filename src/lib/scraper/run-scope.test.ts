import { describe, expect, it } from "vitest";

import {
  IN_FLIGHT_STATUSES,
  partitionByInFlight,
} from "@/lib/scraper/run-scope";

const SOURCES = [
  { id: "s1", name: "Supplier A" },
  { id: "s2", name: "Supplier B" },
  { id: "s3", name: "Supplier C" },
];

describe("partitionByInFlight", () => {
  it("queues everything when nothing is running", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, []);
    expect(queueable).toHaveLength(3);
    expect(skipped).toEqual([]);
  });

  it("skips a source that already has a job in flight", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, ["s2"]);
    expect(queueable.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(skipped).toEqual(["Supplier B"]);
  });

  it("queues nothing when every source is busy", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, [
      "s1",
      "s2",
      "s3",
    ]);
    expect(queueable).toEqual([]);
    expect(skipped).toEqual(["Supplier A", "Supplier B", "Supplier C"]);
  });

  it("reports skips by name, because a cuid is not actionable", () => {
    const { skipped } = partitionByInFlight(SOURCES, ["s3"]);
    expect(skipped).toEqual(["Supplier C"]);
  });

  it("ignores null sourceIds — a job whose source row was deleted", () => {
    // ScrapeJob.sourceId is nullable (onDelete: SetNull), so the in-flight
    // query can legitimately return nulls. They must not match anything.
    const { queueable, skipped } = partitionByInFlight(SOURCES, [null, "s1"]);
    expect(skipped).toEqual(["Supplier A"]);
    expect(queueable.map((s) => s.id)).toEqual(["s2", "s3"]);
  });

  it("is unaffected by a busy id that is not in this batch", () => {
    const { queueable, skipped } = partitionByInFlight(SOURCES, ["s99"]);
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
});
