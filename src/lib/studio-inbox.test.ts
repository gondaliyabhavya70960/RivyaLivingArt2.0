import { describe, expect, it } from "vitest";
import { shapeInbox, type StudioInboxRows } from "./studio-inbox";

const EMPTY: StudioInboxRows = {
  pending: {
    testimonials: 0,
    scrapedProducts: 0,
    products: 0,
    blogPosts: 0,
    portfolios: 0,
    sheetConflicts: 0,
  },
  scrapeJobs: [],
  importRuns: [],
  activity: [],
};

describe("shapeInbox", () => {
  it("returns nothing waiting on an empty inbox", () => {
    expect(shapeInbox(EMPTY)).toEqual([]);
  });

  it("lists only pending queues with a count above zero", () => {
    const items = shapeInbox({
      ...EMPTY,
      pending: { ...EMPTY.pending, testimonials: 3, products: 1 },
    });
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.kind === "pending")).toBe(true);
    expect(
      items.find((item) => item.id === "pending:testimonials")?.label,
    ).toBe("3 testimonials");
    expect(items.find((item) => item.id === "pending:products")?.label).toBe(
      "1 product",
    );
  });

  it("pending queues lead, then everything else sorts newest first", () => {
    const items = shapeInbox({
      ...EMPTY,
      pending: { ...EMPTY.pending, sheetConflicts: 2 },
      scrapeJobs: [
        {
          id: "job-old",
          sourceName: "Etsy",
          status: "DONE",
          totalScraped: 10,
          newCount: 2,
          error: null,
          finishedAt: new Date("2026-01-01T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      importRuns: [
        {
          id: "run-new",
          trigger: "MANUAL",
          created: 5,
          updated: 1,
          failed: 0,
          abortedReason: null,
          startedAt: new Date("2026-01-03T00:00:00Z"),
        },
      ],
      activity: [
        {
          id: "act-mid",
          action: "publish",
          entity: "Product",
          entityId: "p1",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          userName: "Rivya",
        },
      ],
    });

    expect(items.map((item) => item.id)).toEqual([
      "pending:sheetConflicts",
      "import-run:run-new",
      "activity:act-mid",
      "scrape-job:job-old",
    ]);
  });

  it("marks a failed scrape job and an aborted import run as warning tone", () => {
    const items = shapeInbox({
      ...EMPTY,
      scrapeJobs: [
        {
          id: "job-fail",
          sourceName: "Etsy",
          status: "FAILED",
          totalScraped: 0,
          newCount: 0,
          error: "Timed out",
          finishedAt: new Date("2026-01-01T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      importRuns: [
        {
          id: "run-abort",
          trigger: "DEPLOY",
          created: 0,
          updated: 0,
          failed: 0,
          abortedReason: "Blast-radius cap exceeded",
          startedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });

    const job = items.find((item) => item.id === "scrape-job:job-fail");
    const run = items.find((item) => item.id === "import-run:run-abort");
    expect(job?.tone).toBe("warning");
    expect(job?.detail).toBe("Timed out");
    expect(run?.tone).toBe("warning");
    expect(run?.detail).toBe("Blast-radius cap exceeded");
  });

  it("caps the result at 20 items", () => {
    const activity = Array.from({ length: 30 }, (_, i) => ({
      id: `act-${i}`,
      action: "publish",
      entity: "Product",
      entityId: null,
      createdAt: new Date(2026, 0, 1, 0, 0, i),
      userName: "Rivya",
    }));
    const items = shapeInbox({ ...EMPTY, activity });
    expect(items).toHaveLength(20);
  });
});
